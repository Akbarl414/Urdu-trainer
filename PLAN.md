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
  fonts/                       # self-hosted Noto Nastaliq Urdu woff2 (D5); Noto Naskh Arabic added in Phase 7
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
  script/                      # Phase 7: letters.js, readable.js, deck.js, machine.js (§13)
  modules/                     # ── FREE TO REDESIGN ──
    today/  lesson/  review/  games/  library/  settings/
    debug/voices.js            # #/debug/voices: lists speechSynthesis voices + Roman→Devanagari test box (Phase 1, D2, D13)
    script/                    # Phase 7: hub, lesson, chart, practise, trace, tiles, match
    exercises/                 # one renderer per exercise type
  ui/                          # ── FREE TO REDESIGN ──
    components/ (tabbar, button, card, urduText, audioButton, banner, ...)
    styles/ (tokens.css, base.css, ...)
content/                       # ── STABLE CONTRACT ──
  ROMANIZATION.md  CURRICULUM.md  shipped-ids.json
  schemas/ unit.schema.json, vocab.schema.json, lesson.schema.json, exercise.schema.json
  units/unit-01/ unit.json, vocab.json, lesson-001.json … lesson-010.json
  script/ alphabet.json, lessons/script-01.json …   # Phase 7 (§13)
scripts/
  validate-content.js          # schemas + cross-file rules + romanization + id lockfile
  check-coverage.js            # warning-only token coverage per lesson
  lock-ids.js                  # appends newly shipped ids to content/shipped-ids.json
tests/
  fixtures/storage-v1.json, storage-v2.json  # one snapshot per STORAGE_VERSION, never edited once added
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

### 3.2 Blob shape (v4; v3 plus `settings.themeMode` and a new meaning for `theme`, v2 plus `settings.learnerGender`, v1 plus `settings.answerMode`)

```js
{
  version: 4,
  meta: { createdAt, lastExportAt, lastOpenedAt, lastSeenBuild },
  settings: {
    answerMode: 'type',              // v2: 'speak' | 'type' | null, the remembered Speak/Type toggle; 'type' is the default since v4
    learnerGender: null,             // v3 (D23): 'm' | 'f' | null (not asked yet), picks the learner's own lines
    showScript: false, audio: true, speechRate: 0.9, voiceURI: null,
    dailyReviewCap: 60, theme: 'truck-art', themeMode: 'system', dayRolloverHour: 4, // v4 (D27): theme = look, themeMode = 'system' | 'light' | 'dark'
   
    noVoiceNoteSeen: false,
    // script track (§13), inert until Phase 7
    scriptInDailyReviews: false, scriptDailyCap: 30, scriptNewWordsPerDay: 5,
    scriptSuggestions: true, scriptChartOrder: 'alphabetical', scriptChartFont: 'naskh'
  },
  progress: {
    lessons: {                       // lessonId -> record
      'lesson-001': { firstCompletedAt, lastCompletedAt, timesCompleted, knownWordIds: [] }
    },
    run: null,                       // the lesson in progress (see §6), or null
    script: { lessons: {}, run: null, lastSuggestedAt: null }   // §13, inert until Phase 7
  },
  srs: {
    decks: {
      main:   { cards: { '<cardId>': CompactCard } },   // w:… and x:… cards
      script: { cards: { '<cardId>': CompactCard } }    // s:… cards (§13), empty until Phase 7
    }
  },
  stats: {
    streak, bestStreak, lastStudyDay,               // 'YYYY-MM-DD' in study-day terms
    days: { 'YYYY-MM-DD': { reviews, newWords, lessons, games, seconds, scriptReviews, scriptLessons } },
    pace: { reviewSec: 10, wordSec: 20, exerciseSec: 20, scriptReviewSec: 8 },  // moving averages for the planner
    gameBests: {}
  },
  flags: [ { id, createdAt, target: { kind, id, field }, note, build } ],  // "Report a mistake"
  userContent: { words: [] }        // reserved (D9); included in export
}
```

**CompactCard** (`srs/fsrs.js` is the only module that knows how this maps to ts-fsrs's `Card`):
`{ due, s, d, st, r, l, lr, sd, ls, weak? }` stores due (epoch ms), stability, difficulty, state (0 New, 1 Learning, 2 Review, 3 Relearning), reps, lapses, last review (ms), scheduled days, learning step, and an optional game "weak" timestamp. Short keys matter here. A full deck holds about 7,000 cards, roughly 0.6 MB compact versus about 1.8 MB verbose, and localStorage is capped at about 5 MB per origin, **which is shared with the German app**. The script deck adds at most ~80 letter cards plus 5 word cards per practice day (a few hundred in practice), which is small next to the main deck.

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
- **Phase 3a additions (D22)**, made before any real content shipped:
  - Nouns: `gender` is `m`, `f` or `mf` (person nouns whose gender follows the person, like `dost`; no gender card). Every countable noun gives `plural` and `oblique_pl` (not only marked ones); `mass: true` nouns (`paanii`) are exempt; `plural_only: true` marks nouns that are already plural (`log`).
  - Agreeing words: `variable: true` is allowed on adjectives, pronouns, postpositions and `other` (`meraa`, `kaa`, `kitnaa`), and then requires `agreement: { m_sg, f, m_pl }`. Games generate agreement items from these listed forms only.
  - Phrases require `situation` (the prompt for `situation_to_phrase`); any word may carry `literal` (word-for-word English, e.g. `kyaa haal hai?` = "what state is?").
  - Lessons: `dialogue` is `{ setting, speakers: [{ id, en, gender?, learner? }], lines: [{ speaker, roman, ur, en }] }`. Non-learner speakers need a gender; the learner's gender comes from settings (D23). Grammar has 1–4 screens, each with optional `examples` (triples). `unlocks` is limited to the known features.
  - Exercises: optional `hint` (prose) on every type, instead of the trailing `(...)` convention.
- **Learner gender (D23)**: wherever the learner speaks about themselves, the base fields are the man's form and an optional `learner_f` holds the woman's. On a learner's dialogue line it is `{ roman, ur, en? }`. On an exercise it lists the fields that replace the base ones (shallow; never `id`, `type`, `tags`, `retired`). `src/lesson/learner.js` picks the form from `settings.learnerGender`; review cards use it too, so a card id never depends on gender. The validator checks the merged woman's version like any exercise, and warns when a first-person sentence (`maiN` / `huuN`) contains a gendered form (an agreeing or perfective form from vocab, `thaa`, `rahaa`, `-taa`, `-ngaa`, …) with no `learner_f`.
- Words: optional `ur_alt` lists other correct Urdu spellings in common use (`الحمد للہ` / `الحمدللہ`). `ur` is the one shown; Spell practice (§13.2) accepts any of them.

### 4.3 Validator rules (beyond schemas)
- Every `roman` and `answers[].roman` field passes `lang/romanization.js` (character set, the capital rule, `c` only in `ch`/`cch`, `N` only word-final after a vowel, no `v`, no `ee`/`oo`; see ROMANIZATION.md §6).
- Loanword exemption: tokens that match the `roman` or `forms` of a `loanword: true` word introduced in this or an earlier lesson only need to be lowercase (a final `N` from an Urdu ending is allowed). Any other token is checked normally.
- Every `roman` has a non-empty sibling `ur` (Arabic-script range check) and `en`.
- `ur` fields use Urdu code points (`ی` U+06CC, `ک` U+06A9, `ہ` U+06C1, `ھ` U+06BE), never the Arabic look-alikes `ي ك ه`. This is needed by the script track (§13.6) and catches copy-paste errors.
- Nouns require `gender` and `marked`; marked nouns require `plural` and `oblique_pl`. Verbs require `infinitive`, `stem`, `transitivity`, `takes_ne`, and `perfective.{m_sg,f_sg,m_pl}`.
- Ids are unique across the whole app (words, lessons, units). `new_vocab` ids exist and their `introduced_in` equals the lesson. Each word is introduced exactly once.
- Lessons have 6–10 new words (0–4 for review lessons) and 8–12 exercises. Units hold ≤ 80 words.
- `reorder`: every `answerOrders` entry is a permutation of `tokens`.
- `fill-blank` requires `sentence.en`. `multiple-choice`/`choose-form` options must not contain `(` (the reference's rule that annotated options give the answer away).
- Inflections are checked where they are regular (D22): a marked noun is masculine `-aa` with `plural` `-e` (ے) and `oblique_pl` `-oN` (وں); every `oblique_pl` ends in `-oN`; `agreement` forms are `-aa / -ii / -e` (ا / ی / ے) and `m_sg` equals the word's roman. Irregular feminine or unmarked-masculine plurals are warnings, not errors. Dialogue speakers are declared once, at most one is the learner, and every other speaker has a gender. The word-id prefix `seed-` is reserved (D21).
- Prose fields (`body`, `heading`, `notes`, `explanation`, `hint`, `setting`, `situation`, `literal`, `instruction`, `prompt`) have their backticked Urdu checked against the scheme.
- **Id lockfile**: every id in `content/shipped-ids.json` must still exist (it may be `retired: true`). `npm run lock-ids` appends new ids, and Phase 1 adds it to the deploy workflow before build, so anything that reaches `main` gets locked.

### 4.4 Coverage checker
`npm run check-coverage` (`scripts/lib/coverage.js`) tokenises every roman field in each lesson (grammar tables and examples, exercises, dialogue) and the example sentences of the words it introduces, after stripping punctuation and `___`. It then subtracts: every word introduced in this or an earlier lesson, with its `forms`, `plural`, `oblique_pl` and `agreement` forms (not its perfective, which is taught much later); and `content/coverage-allowlist.json`, which has `from_lesson` (tokens taught in a lesson's grammar screens rather than as vocab, allowed from that lesson on, e.g. `huuN haiN hai` from lesson-001) and `names`. The allowlist must follow the scheme. English prose is not checked. It prints leftovers per lesson and never fails.

### 4.5 Retiring content
`retired: true` on a word or exercise keeps its id and SRS card. Such items stop appearing in new sessions and games, but the library still shows them as "retired", and backups still contain them.

---

## 5. SRS design

### 5.1 Card ids
- `w:<wordId>:<facet>` for words and phrases (word ids are globally unique).
- `x:<lessonId>:<exerciseId>` for exercises (one card each).
- `s:l:<letterId>:<facet>` and `s:w:<wordId>:<facet>` for the script deck (§13.3). They live in `srs.decks.script`, never in `srs.decks.main`. The `s:` prefix is reserved from Phase 1.
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
- Uses the current `DefaultScheduler` API pinned to `version: 'FSRS-6'` (its default is FSRS-7, which would change every interval), created once at module load (it is async). The card id seeds fuzz, so cards spread out but each card is stable. The stored CompactCard is independent of the library's own card fields (`toFsrs`/`fromFsrs` in `srs/fsrs.js` translate), so upgrading the library never touches stored data. Verified against the previous classic-API build: identical results on 45 of 50 comparison points; the 5 differences are cards with stability under a day, where the classic API gave Good and Easy the same interval and this one separates them by a day.
- Buttons show the `preview()` due time of each grade, formatted like `10m · 1d · 3d · 9d`.
- **Lesson items on commit**: a new word's cards start New and get one rating from what happened in the lesson (practised correctly → Good, missed → Again). They first come back later the same day or the next day. **"I already know this"** cards get Easy applied twice, about 1 minute apart internally. That gives a first interval of roughly 1–3 weeks, and the facets keep their own memory state.
- **Exercise cards** get their rating from the lesson attempt (correct → Good, hint → Hard, wrong → Again).

### 5.4 Daily queue (`queue.js`)
1. Candidates: all non-retired cards with `due ≤ end of study day`, excluding the New state (every card is born from a lesson, so the deck has no "new card" stream).
2. Priority: Learning/Relearning cards first. Then sort by lowest current retrievability, multiplied by 1.25 for production facets and by 1.2 for weak-flagged cards.
3. **Cap**: take at most `dailyReviewCap − reviewsDoneToday`. The rest stays due. Because the most-forgotten cards go first and FSRS reschedules from the actual review date, a backlog drains over several days instead of arriving in one session. Today shows an honest line: "182 due · about 3 days to catch up at 60/day".
4. **Sibling spacing**: no two adjacent cards share an item key (word id or lesson id). The queue greedily interleaves. If spacing is impossible in a short session, the later sibling moves to the end.

### 5.5 Answer checking (`lang/normalise.js`)
- `exact(a, b)`: trim, collapse whitespace, strip punctuation; then compare byte for byte (case matters because `T ≠ t`).
- `lenientKey(s)` folds both sides. It lowercases (folding T/D/R/N/Gh), and a word-final nasal is optional **only when the expected word has a capital `N`** (so `huuN`, `hun`, `hu` all match `huuN`). A plain final `n` is a real consonant: `din ≠ dii`, `jaan ≠ jaa`, an extra or missing one is a mismatch in both directions. collapses `aa→a`, `ii→i`, `uu→u`, collapses doubled consonants (`pakkaa ~ pakaa`), treats a hyphen as a space, and maps `ee→i`, `oo→u`, `v→w`, `mein→me`, `hain→hai` (D4: accepts the common phone spellings `theek`, `hoon`, `mein`, `vo`). Fixed greetings typed as phone users do (`assalamualaikum`, `salam`, `walaikum assalam`, `alhamdulillah`, …) are close enough when the expected answer contains that greeting (`PHONE_PHRASES`, D23 decisions); a variant never stands in for a different phrase. Loanwords are matched case-insensitively, ignoring punctuation.
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
- Deploy: the reference workflow (Node 22 → `npm ci` → `npm run build` → Pages), with `npm test` added before build.

---

## 10. Audio
- **The main device is an iPhone**, which may have no Urdu voice. Phase 1 ships `#/debug/voices`, a small page that lists every `speechSynthesis` voice on the device (name, lang, local/remote, default), highlights `ur*` voices, and has a "speak sample" button per Urdu voice. We confirm what's really there before deciding on pre-generated audio.
- `tts.js` loads voices (handling `voiceschanged` and iOS lazy loading). The decision of *how* to speak an item is `src/audio/speakPlan.js` (pure, tested), in this order (D13):
  1. **Pre-recorded `audio` file**, when the item has one. Always wins.
  2. **Urdu voice** (`voice.lang` is `ur`, `ur-PK` or `ur-IN`) speaking the **`ur` field**.
  3. **Hindi fallback**: with no Urdu voice but a `hi*` voice, speak the item's `roman` converted to Devanagari by `src/lang/devanagari.js` and read with the Hindi voice. Loanwords (tokens from loanword entries) pass through unconverted. Conversion happens at runtime from the romanization scheme; there are no extra content fields and the Devanagari is never shown or stored.
  4. Otherwise `canSpeak()` is false: audio buttons are hidden, listen exercises and the Listen game are skipped, and a one-time note appears in Settings.
- **Converter rules** (`devanagari.js`, deterministic): greedy longest match; aspirates `kh gh chh jh Th Dh th dh ph bh` and `sh` as single letters; nuqta letters `q x Gh z f` and flap `R`/`Rh` (ड़ ढ़); `cch` is च्च except in `acch…` (अच्छा); consonant + consonant gets a halant (the roman has no vowel there), word-final consonants don't; vowel + `n` + consonant is anusvara (`aankh` आंख); word-final `N` is anusvara over `ai ii i e o au` and chandrabindu otherwise (`maiN` मैं, `huuN` हूँ). Tested against all 60 worked examples in ROMANIZATION.md.
- If an item has `audio` (a file path under `public/audio/`), it plays instead of TTS. The SW caches audio on first play (cache-first, prefixed cache).
- `recorder.js` provides record → play back → play model, all in memory (Blob URL revoked on leave), with nothing persisted. It is hidden when `MediaRecorder` or microphone permission is unavailable.

---

## 11. Phase-by-phase test map (brief §10)
- **P1**: storage (migrations over fixtures, prefixing, export/import round trip, corrupt data → recovery with no wipe, erase keeps foreign keys, quota path), validator (bad romanization, word-internal `N`, missing `ur`, missing `perfective`/`takes_ne`, duplicate ids, unknown vocab ids, lockfile, loanword exemption both ways), the banned-API grep. Manual check: open `#/debug/voices` on the iPhone and report the list.
- **P2**: FSRS wiring, facet unlocking, cap, priority, backlog spreading, sibling spacing, already-know path, normaliser.
- **P3**: planner budget and modes, machine transitions and resume, commit adds the right cards exactly once, unlock order.
- **P7**: letter decomposition (`ur` → letter ids, including `لا`, `آ`, hamza forms), readable-word rule, script deck isolation (no script card in the main queue unless the setting is on; 1-in-4 cap when it is), new-word stream cap, alphabet validator rules, the review-lesson suggestion appears only after review lessons and never blocks.

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
| D6 | Order | `thaa / thii / the` moved to **Unit 7, lesson 069**. Unit 11 now opens with perfectives (`perfective` unlocks at lesson 101). Chunks before grammar are used, with exercises testing meaning only. **Exception (Phase 3a):** lesson-001 e09 asks `aap kaise haiN?` vs `aap kaisii haiN?`, because the form follows the person addressed and getting it wrong matters socially; it is taught as two chunks, and Unit 2 explains the pattern. |
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
| D18 | Script track (added after Phase 0) | Optional track in Learn, built as Phase 7 (§13). Separate script deck, not in daily reviews unless a setting is on. Storage slots exist from v1 so no migration is needed. |
| D13 | Audio fallback (decided after the Phase 1 voice test) | Voice test on the main iPhone (iOS 18.7): **no Urdu voice; one Hindi voice, hi-IN "Lekha"**. So: Urdu voice if present (speaks `ur`) → otherwise a runtime Roman Urdu → Devanagari converter read by a Hindi voice → pre-recorded `audio` files always win when present. No new content fields. `#/debug/voices` has a type-in box (Roman Urdu → Devanagari → hear it) so the quality can be judged on the phone. Built as a Phase 1 fix-up; lesson audio comes in Phase 3. Fallback quality is unproven until judged on the device; if it is poor, pre-generated audio (D2) is the next step. |
| D19 | Review answer modes (Phase 2) | Facets declare which modes they support (`src/srs/cardFace.js`). **Reveal**: recognition facets (`meaning_ur_en`), self-graded. **Speak / Type**: production and form facets. Speak = say it aloud, reveal, self-grade; Type = type Roman Urdu, checked by `lang/normalise.js`, and the result only *suggests* a grade (the learner always presses it; free-order answers such as `translate` can't be judged by the checker). Production facets and `translate` default to Speak; typed-form facets (`perfective`, `fill-blank`, `transform`, `error-spot`) default to Type. **Choice**: `gender`, `takes_ne`, `multiple-choice`, `choose-form`. A Speak/Type toggle is on the card; the choice is saved as `settings.answerMode` (`'speak' | 'type' | null`, null = no choice yet, so each card type uses its own default) and applies to every card that offers both modes. Adding the field bumped `STORAGE_VERSION` to 2 with `MIGRATIONS[1]` (sets it to null, never overwrites) and `tests/fixtures/storage-v2.json`, per CLAUDE.md. `listen` exercises are not reviewable until audio arrives in Phase 3. |
| D20 | New-state cards in the queue (Phase 2) | §5.4 said New cards are excluded. But a facet unlocked later (e.g. `perfective` for every verb already learned) is created New with nothing to rate it, so it would never appear. The queue therefore includes due New cards at a neutral priority (retrievability 0.8): introduced soon, never ahead of genuinely overdue cards. Cards born from a lesson still arrive with their first rating. |
| D21 | Test cards (Phase 2) | `src/srs/seed.js` and `#/debug/seed` add ids prefixed `w:seed-` / `x:seed-lesson:` to the main deck. They are additive, never overwrite a card, and the page's remove button deletes only those ids. Review resolves their words from `seed.js` when the course content doesn't have them. **Phase 3 starts by deleting `src/srs/seed.js`, `src/modules/debug/seed.js` (and its route and home-screen link), and adding a one-off boot cleanup that removes cards whose ids start with `seed-` (`w:seed-…` and `x:seed-lesson:…`) from the main deck, and nothing else; the cleanup is itself removed once it has had time to run on the devices that used the test cards.** |
| D22 | Schema review (Phase 3a) | Before the first real content, the schemas were checked against Units 1–3 and changed where a later change would mean rewriting shipped content (§4.2): nouns `mf` / `mass` / `plural_only` and `plural` + `oblique_pl` on every countable noun (feminine plurals are irregular enough to need listing, and Unit 4 needs every oblique plural); `variable` + required `agreement` forms for possessives and `kaa / kii / ke` (Unit 3) as well as adjectives, so games never derive forms from spelling; required `situation` on phrases and optional `literal`; `dialogue` as `{ setting, speakers, lines }` with speaker gender (Urdu agrees with the speaker) and a learner role (its gender comes from settings, D23); optional grammar `examples`; `unlocks` limited to known features; an explicit exercise `hint` field instead of trailing `(...)`, because prompts are triples whose `en` is reused in reveals (the reference app also supports an explicit `hint`). No stored data changed shape, so no migration. `honaa` is taught as a word in lesson 003 with its full table; lesson 001 uses `huuN / haiN / hai` from its grammar screens (coverage allowlist). The D21 cleanup is done: `src/srs/seedCleanup.js` runs at boot and is to be deleted once it has run on the devices that had test cards. |
| D23 | Learner gender (Phase 3a) | The learner's own lines (dialogue lines spoken by the learner, exercises where the learner speaks about themselves) store both forms: base = man's, `learner_f` = woman's (§4.2). New setting `settings.learnerGender` (`'m' \| 'f' \| null`): asked once on first run, changeable in Settings. Adding it bumped `STORAGE_VERSION` to 3 with `MIGRATIONS[2]` (sets null, never overwrites) and `tests/fixtures/storage-v3.json`, per CLAUDE.md. While it is null, the base form is shown and the woman's version is offered as `alt`. **Built so far:** storage, schema, validator, resolver, Review cards. **Phase 3b:** the first-run question is built on Today (shown whenever the setting is null, so existing installs are asked too; "Not now" lasts until the app is reopened; a "Change" link reopens it). **Still to build:** the Settings switch (Phase 5). Lesson 1 needs no `learner_f`: everything the learner says there (`Thiik`, `huuN`, `bhii`) is the same for a man or a woman. Same session: lesson-001 dialogue reset so the learner arrives both times; `kaise haiN aap?` accepted; `ur_alt` added; greeting phone spellings accepted. |
| D24 | Lesson player (Phase 3b) | Built as §6 describes, with these decisions. **Stored data:** the run lives in the existing `progress.run` (no shape change, no migration); it carries `v: 1`, and a run this build can't read (newer version, missing lesson, changed exercises) is reported on Today and never deleted or overwritten. "Start this lesson again" is an explicit, confirmed choice that drops only the unfinished run. **Commit** works on a copy and swaps it in, then one `store.save()`. "Done today", "next lesson" and the streak are derived from stats and progress, so nothing new is stored. **Script toggle:** Urdu script is always in the DOM and shown by `html.show-script`, so toggling never redraws a screen or loses a half-typed answer; `urduText()` no longer takes `showScript`. **Font:** Noto Nastaliq Urdu (arabic subset, 239 KB) self-hosted in `public/fonts/`, precached into `urdu-trainer-fonts-v1`. **Answer options:** English attached to an option (`en` on a triple) stays hidden until answered; plain-string options (listen exercises, word recognition) are the English answers themselves and are shown. **Reorder** in the player uses tiles (Speak/Type apply to fill-blank, error-spot, translate, transform and a new word's production check; the saved choice is shared with Review). **Words:** per word intro → "I already know this" or "New to me" → recognition (pick the meaning) → production (Speak/Type); results rate `meaning_ur_en` and `meaning_en_ur` / `situation_to_phrase` on commit. **Hint** caps the exercise card at Hard. **Warm-up** cards are the Review screen's own card view (shared `cardView.js`). **Skipping:** `listen` exercises are dropped from the plan when no voice exists; "Skip the rest of the warm-up" is offered. A completed lesson can't be replayed yet (`practiceOnly` waits for the Library, Phase 5); superseded by D25. |
| D25 | Lessons 2–5 and practice replay (Phase 3c) | **Practice replay:** a completed lesson can be replayed from Today (“Practise a finished lesson”, `#/practice/<lessonId>`) until the Library takes it over (Phase 5). The replay run lives in memory only (`src/lesson/practice.js`): no warm-up, every exercise, no `progress.run`, no commit, no cards created or rescheduled, no stats or streak, so it can't disturb a real lesson in progress. This replaces §6.2's “exercise results act like game results”: practice never marks cards weak. Only the Speak/Type and script toggles (settings, not progress) are remembered. **D21 finished:** `src/srs/seedCleanup.js` and its boot call are deleted (it has run on the phone); the validator still reserves the `seed-` prefix. **Validator:** an `oblique_pl` after a long `-uu` may end in ؤں (`abbuu` → ابوؤں). **Phone spellings** added for lesson 5 (`nhi`, `pta nhi`, `g` for `jii`, `tayyar`; ROMANIZATION.md §7). **Content:** no first-person sentence in lessons 2–5 uses a gendered form (`Thiik`, `taiyaar`, `student`, `doctor` never change), so none needs `learner_f`; lesson 7 is the first that will. No stored shape changed. |
| D26 | Phase 3c decisions | **Rare plurals:** nouns may carry `plural_rare: true` when `plural` / `oblique_pl` are grammatical but rarely said. The forms stay listed (the validator still checks them, and coverage counts them), but they never become plural cards, game items or plural reveals. All app code reads plurals only through `nounPlural()` in `src/lang/nounForms.js`, which returns null for them (and for mass nouns); the Gender card's plural reveal already uses it, and Phase 4 games must too. Applied to `ammii` and `abbuu` (lesson 004); no other noun in lessons 1–5 qualifies. **Invariable loanwords:** nouns may carry `invariable: true` (loanwords only) when they never take Urdu endings: same form for singular, plural and oblique, so `plural` / `oblique_pl` are left out and `nounPlural()` returns the roman for both. The validator rejects it on non-loanwords and alongside `plural`, `oblique_pl`, `marked`, `mass`, `plural_only` or `plural_rare`. `aunty` (f) and `uncle` (m) are planned as invariable loanwords for lesson 006 (CURRICULUM.md). **Spelling:** `tayyaar` (تیار) is the main spelling, with the doubled consonant; `taiyaar`, `taiyar` and `tyar` are accepted as close enough (`tayyar` folds to it anyway). The word keeps its shipped id `taiyaar` (ids never change), which the validator notes as a warning. **Kept as written:** `saahab`, اسٹوڈنٹ (with سٹوڈنٹ as `ur_alt`), elders calling girls `beTaa`, `jii` after family titles only, `g` for `jii`. **Open, to check with family:** `paRosii` for anyone (and Aisha's `ham paRosii haiN`), and introducing a wife as `merii biiwii haiN`. No stored data changed shape. |
| D27 | Themes (Phase 4a) | Supersedes D10 (grey/teal). **Three looks x light/dark = six variants**, chosen with `settings.theme` (`'truck-art' \| 'jewel' \| 'neon'`, default `truck-art`) and `settings.themeMode` (`'system' \| 'light' \| 'dark'`); `src/ui/theme.js` turns them into `data-theme` / `data-mode` on `<html>` (and the address-bar colour), and "Auto" follows the phone live. **A theme is a token set, never a fork of the components:** `src/ui/styles/tokens.css` (colours, fonts, radii, border widths, shadows, motion, bar fill, background pattern; one block per variant), plus `themes.css` for small decorative flourishes scoped as `[data-theme='x'] …` descendants (Truck Art diamond rows, thick borders, striped bars; Jewel gold rules, faint tile pattern, gold milestones; Neon Pop skewed bars, hard shadows, pop-in animations). Components only use tokens (`--radius`, `--border-w`, `--shadow-btn`, `--font-head`, `--bar-fill`, `--dur`/`--ease`, …). Because decorative rules are descendant selectors, two looks must never be nested; `#/debug/themes` therefore drops the root theme and gives each side-by-side panel its own. **Fonts:** headings only, latin subset, variable woff2, self-hosted in `public/fonts/` with their OFL texts and precached into `urdu-trainer-fonts-v1`: Baloo 2 (Truck Art), Playfair Display (Jewel), Space Grotesk (Neon Pop). Body text stays on the system font for phone readability. **Contrast:** `tests/theme-contrast.test.js` parses `tokens.css` and fails the build if any text pairing (including tinted backgrounds, links, filled buttons, feedback colours) drops under WCAG AA 4.5:1, or a meaningful border / focus ring under 3:1, in any of the six variants. `deco-*` colours are decorative only. `prefers-reduced-motion` zeroes the motion tokens and animations. **Stored data:** `STORAGE_VERSION` 4, `MIGRATIONS[3]`, `tests/fixtures/storage-v4.json`. The old `theme` value (`system`/`light`/`dark`) moves into `themeMode` (a device that chose dark stays dark) and `theme` becomes `truck-art`; a saved look, mode or answer mode is never overwritten. **Answer mode default:** `answerMode` null becomes `'type'` in the same migration, and new installs start on `'type'`; a saved `'speak'` is kept. **UI:** a prominent "Choose a look" card on Today (three swatches drawn in their own colours, Auto / Light / Dark) until Settings (Phase 5) takes it over; the recovery screen uses the default look and follows the phone's light/dark setting because storage is blocked there. |

---

## 13. Script track (optional; designed now, built in Phase 7)

Reading Urdu script is still not a goal of the main path. This is an **optional** side track for when you want it. It lives in the **Learn** tab and never blocks, gates, or slows the daily lessons.

### 13.1 Shape of the track
- **12 lessons of about 10 minutes**, unlocked in order, independent of the main lesson path.
- **Shapes are taught in Naskh first** (upright, one letter after another, easy to see). Nastaliq, the sloping style real Urdu is printed in, comes in the last lesson.
- **Suggestions, never pushes**: each unit's review lesson (`review: true`) ends its summary screen with a skippable card: "Next Script lesson: S04 · s-family · ~10 min" with **Start** and **Not now** buttons. The card isn't shown when the track is finished or `settings.scriptSuggestions` is off.

| # | Id | Lesson | Covers |
|---|---|---|---|
| 1 | `script-01` | How the script works | Right to left; letters join; dots tell letters apart. Alif and the **b-family** `ب پ ت ٹ ث` |
| 2 | `script-02` | Letters that don't join forwards | The **non-joining letters** `ا د ڈ ذ ر ڑ ز ژ و`, and why words break into pieces |
| 3 | `script-03` | The j-family and its cousins | `ج چ ح خ`, then `ع غ` |
| 4 | `script-04` | The s-family | `س ش ص ض ط ظ` |
| 5 | `script-05` | f, q, k, g, l, m, n | `ف ق ک گ ل م ن` (the commonest consonants) |
| 6 | `script-06` | The nasal ں | `ں` (nuun Ghunnaa) and how it maps to the word-final `N` of our scheme |
| 7 | `script-07` | و and ی: consonant or vowel? | `و` = w / uu / o / au; `ی` = y / ii; `ی` vs `ے` (choTii ye / baRii ye) |
| 8 | `script-08` | ہ and the aspirates | `ہ` vs `ھ`; `bh ph th Th jh chh dh Dh kh gh Rh` |
| 9 | `script-09` | The marks people leave out | Short vowel marks (zabar, zer, pesh), jazm, shadd, `آ`, and why everyday text omits them |
| 10 | `script-10` | Hamza and vowel pairs | `ء ئ ؤ ۓ` as in `gaye` گئے, `bhaaii` بھائی, `aaiye` آئیے |
| 11 | `script-11` | Little words as whole shapes | High-frequency words read at a glance: `ہے ہیں میں کا کی کے نہیں اور` |
| 12 | `script-12` | From Naskh to Nastaliq | Sloping words, stacked joins, dots that move; re-reading known words in Nastaliq |

Each script lesson runs: intro (2–3 screens) → letters (forms and tracing for each new letter) → practice (mixed types below) → summary. It uses its own small state machine (`script/machine.js`, same pattern as §6.2), stored in `progress.script.run` so it can be resumed.

### 13.2 Practice types
| Type | What happens | SRS |
|---|---|---|
| **Read** (script → Roman) | A word you've already learned is shown in script, taken from its existing `ur` field. You type the roman (normaliser, §5.5) or pick from 4 options early on | `s:w:<wordId>:read` |
| **Spell** (letter tiles) | You see roman + English and tap isolated-letter tiles in order. The word joins up live as you build it. The check compares letter sequences (diacritics stripped) against `ur` and every spelling in the word's `ur_alt` (vocab, D23: e.g. both `الحمد للہ` and `الحمدللہ`) | `s:w:<wordId>:spell` |
| **Trace** | Your finger traces over a large faint letter outline on a canvas (the glyph is drawn from the Naskh font), then **Close enough / Try again**. Self-checked; no stroke-order data in v1 | none (practice only) |
| **Letter match** (game) | Match isolated ↔ joined forms, or letter ↔ sound, against a timer | wrong → `weak` on the letter's cards (§5.6 rules) |

**Which words are readable** (`script/readable.js`, pure, tested): a word becomes available for Read and Spell once (a) its lesson in the main path is complete and (b) every letter in its `ur` (after decomposition into letter ids; harakat stripped; `لا` → ل + ا; `آ` → alif madda) has been taught in a completed script lesson. Early on, when few learned words are readable, the pool is topped up with the alphabet chart's example words. These are marked "preview" and create no meaning cards.

### 13.3 Script deck (separate from daily reviews)
- **Letter cards**: `s:l:<letterId>:sound` (shape → sound) and `s:l:<letterId>:forms` (recognise the letter inside a joined word). They are created when the letter's script lesson is completed.
- **Word cards**: `s:w:<wordId>:read` and `s:w:<wordId>:spell`. Unlike the main deck, the script deck has a **new-card stream**, because creating cards for every readable word would add ~2,900 cards: each "Practise script" session introduces up to `scriptNewWordsPerDay` (default 5) readable words, weakest-and-most-recent main-path words first.
- **"Practise script"** button (Learn → Script) runs the script queue with its own cap `scriptDailyCap` (default 30). It has the same priority, sibling spacing and FSRS settings as §5.4, using the recognition retention (0.85).
- **Not in daily reviews by default.** With `settings.scriptInDailyReviews: true`, due script cards join the daily queue, share the main `dailyReviewCap`, and are capped at 1 in 4 of the session so speaking practice stays dominant.
- Script reviews are counted separately in stats (`scriptReviews`) and never count toward the main backlog, catch-up mode or the lesson planner.

### 13.4 Alphabet reference chart
A page in the Learn tab (`#/learn/alphabet`), linked from every script lesson's header. It is rendered entirely from **`content/script/alphabet.json`** (schema `content/schemas/alphabet.schema.json`). Nothing about letters is hard-coded in the UI.

**One row per letter of the full Urdu alphabet (39)**, in alphabetical order: `ا ب پ ت ٹ ث ج چ ح خ د ڈ ذ ر ڑ ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن ں و ہ ھ ء ی ے`. This includes the Urdu-specific `ٹ ڈ ڑ ں ے ھ`. `آ` (alif madda) appears in the marks table.

| Column | Source field | Notes |
|---|---|---|
| Letter, large | `char` | Must be the Urdu code point (`ی` U+06CC, `ک` U+06A9, `ہ` U+06C1, `ھ` U+06BE), never the Arabic look-alikes |
| Name (Roman Urdu) | `name` + `name_ur` | e.g. `alif`, `be`, `pe`, `te`, `Te`, `jiim`, `nuun Ghunnaa`, `do-chashmii he`, `choTii ye`, `baRii ye`. Romanization rules apply |
| Sound | `sounds: [{ roman, scheme_row }]` | Several sounds where needed (`و` → w / uu / o / au; `ع` → "silent"). `scheme_row` is an anchor id that links to the matching row of ROMANIZATION.md (anchors are added to that table in Phase 7; in the app the link opens a Spelling guide page rendered from ROMANIZATION.md with that row highlighted) |
| Four forms | `joining: "dual" \| "right"`, optional `positions_unused` + `note` | Forms are **rendered by the font** using zero-width joiners (initial = `X‍`, medial = `‍X‍`, final = `‍X`), so nobody hand-types them wrongly. Non-joining (`right`) letters show initial/medial as "doesn't join forwards". `ں` and `ے` mark initial/medial as not used, `ھ` marks isolated as not used |
| Example word | `example: { word_id }` or `example: { roman, ur, en }` | A course word is preferred (`word_id` is resolved from vocab). The validator checks that the example's `ur` contains the letter |
| Audio | speaks `name_ur`; the example has its own button | Hidden without an Urdu voice or `audio` file (§10) |

- **Toggles** (remembered in settings): order **Alphabetical / By shape family** (`family` field: `ب پ ت ٹ ث` together, `ج چ ح خ`, `د ڈ ذ`, `ر ڑ ز ژ`, `س ش`, `ص ض`, `ط ظ`, `ع غ`, `ف ق`, `ک گ`, `ن ں`, `ی ے`, `ہ ھ`, …) and font **Naskh / Nastaliq** for the whole chart.
- **Marks table** below the letters, from `alphabet.json` → `marks[]`: zabar `َ`, zer `ِ`, pesh `ُ`, jazm `ْ`, shadd `ّ`, plus the aspiration marker `ھ` and alif madda `آ`. Each has its name, what it does, and an example (`اَب` ab, `دِل` dil, `تُم` tum, `پکّا` pakkaa, `گھر` ghar, `آپ` aap).
- **Validator** (Phase 7): exactly the 39 letters, no duplicates; every `char` is a single Urdu code point; families cover every letter; `scheme_row` anchors exist in ROMANIZATION.md; example words exist and contain their letter; every letter is taught by exactly one `script-NN` lesson; ids go in the lockfile like all other content.
- **Letter ids** are lowercase name-based and never change: `alif, be, pe, te, te-r, se, jiim, che, …, daal, daal-r, re, re-r, …, nuun-ghunnaa, do-chashmii-he, chotii-ye, barii-ye` (retroflex letters take `-r`, since lowercasing would otherwise make `Te` collide with `te`).

### 13.5 Content and code layout (Phase 7)
```
content/script/alphabet.json            # letters + marks
content/script/lessons/script-01.json … script-12.json
content/schemas/alphabet.schema.json, script-lesson.schema.json
public/fonts/                           # + self-hosted Noto Naskh Arabic (covers Urdu), precached
src/script/ letters.js (ur → letter ids), readable.js, deck.js, machine.js
src/modules/script/ hub, lesson, chart, practise, trace, tiles, match
```

### 13.6 What Phase 1 sets up now, so Phase 7 needs no migration
The v1 blob (§3.2) already contains everything the script track will write, with inert defaults:
- `srs.decks.script.cards: {}` alongside `srs.decks.main.cards`. These are two separate maps, so a script card can never leak into the main queue, backlog counts or the planner by accident.
- `progress.script: { lessons: {}, run: null, lastSuggestedAt: null }`.
- settings `scriptInDailyReviews: false`, `scriptDailyCap: 30`, `scriptNewWordsPerDay: 5`, `scriptSuggestions: true`, `scriptChartOrder: 'alphabetical'`, `scriptChartFont: 'naskh'`.
- `stats.days[d]` counters include `scriptReviews` and `scriptLessons` (0 by default); `stats.pace.scriptReviewSec`.
- Card-id parsing in `facets.js` reserves the `s:` prefix from day one.
- The `tests/fixtures/storage-v1.json` fixture includes a populated script deck, so the "v1 survives every future migration" test covers it.

Phase 1's validator also enforces now that all `ur` fields use Urdu code points (`ی ک ہ ھ`, not the Arabic `ي ك ه`). Letter decomposition depends on this, and it catches a common copy-paste error early.

---

## 14. Build phases

| Phase | Scope |
|---|---|
| 0 | Plan: this file, CURRICULUM.md, ROMANIZATION.md ✅ |
| 1 | Foundations: scaffold, storage + migrations + tests (including the script-deck slots, §13.6), content loader, schemas + validator, PWA + SW, deploy, CLAUDE.md, README.md, `#/debug/voices` |
| 2 | SRS + Review: FSRS engine with facets, Review screen, normaliser, tests |
| 3 | Lesson player + Unit 1 lessons 1–5: Today, lesson flow, auto-add to deck, TTS, script toggle. **Starts by removing the Phase 2 test cards (D21)** |
| 4 | Games: the six games, learned items only |
| 5 | Library + Settings: grammar library, word list, mistake reports, all settings, export/import UI |
| 6 | Content pipeline docs: CONTENT_GUIDE.md, then Unit 1 lessons 6–10 |
| 7 | **Script track** (§13): alphabet chart + schema, 12 script lessons, script deck + "Practise script", Read / Spell / Trace / Letter match, review-lesson suggestions |
