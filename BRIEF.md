# Urdu Trainer — Project Brief for Claude Code

> How to use this file: put it in the root of a new, empty repo as `BRIEF.md`, then tell Claude Code: **"Read BRIEF.md in full, then start Phase 0."** Work through one phase per session, review the result, commit, then `/clear` and start the next phase.

---

## 1. Your role and the goal

You are a senior front-end engineer and an experienced Urdu teacher building a personal language-learning PWA called **Urdu Trainer**. The goal is to take one learner from **A1 to strong B1 / low B2 spoken Urdu** through a short daily lesson (≤15 minutes) plus spaced-repetition drilling and games.

Work in phases (section 11). **Stop at the end of every phase**, summarise what you built, list anything you were unsure about, and wait for my go-ahead. If anything in this brief is ambiguous or seems wrong, ask me before building on it rather than guessing.

## 2. The learner

- Currently **A1**: knows some vocabulary (greetings, family words, food, numbers — patchy), **knows no grammar**. Explain grammar from zero, in plain English, with no linguistics jargon unless it is immediately explained.
- Goal is **conversation**: understanding and speaking. Reading/writing Urdu script is not a goal.
- Uses Urdu for: **family / partner's family**, **films, music and media** (lots of Hindi–Urdu overlap), and **community / everyday life in the UK**.
- Lives in the UK, studies mostly on a phone (iPhone or Android), sometimes on a laptop.
- Will use the app daily, but will sometimes miss days. The app must never punish a missed day with an unmanageable pile of reviews.

## 3. Non-negotiables

1. **User progress data is sacred.** Same rule as my German app: no change may reset, wipe, or silently break compatibility with progress already stored on the device. Versioned storage, explicit migrations, fail loud and never wipe on parse errors. Write this into `CLAUDE.md` in Phase 1, modelled on the German app's `CLAUDE.md`.
2. **Namespace all storage.** My German app is hosted on the same `<username>.github.io` origin, and **localStorage is shared per origin, not per repo**. Every key this app writes must be prefixed (e.g. `urdu-trainer:`). Never read, write, or clear keys outside that prefix. `localStorage.clear()` is banned anywhere in the codebase; "erase progress" removes only this app's prefixed keys. Likewise, the service worker's cache names must be prefixed and its scope limited to this repo's path, and cache cleanup must only delete this app's caches.
3. **One romanization scheme, used everywhere, enforced by the validator** (section 6).
4. **Content ids never change once shipped.** Lessons, words, exercises, and phrases are referenced by SRS cards; renaming an id orphans progress. Add new ids, never rename. Retire content with a `"retired": true` flag rather than deleting it.
5. **Urdu accuracy matters more than volume.** Never generate more than one lesson unit (≈10 lessons / ≤80 new words) in a single pass. Validate, re-check genders and verb forms by hand, then continue.
6. **UI can change freely; data cannot.** Keep a clean separation: `src/db/` (storage + migrations) and `content/` (versioned JSON) are stable contracts; everything under `src/ui/` and `src/modules/` can be redesigned at will.

## 4. Reference: my German app

A copy of my German app (Deutsch Trainer) is cloned into `reference/deutsch-trainer/` (gitignored, read-only — never modify it, never import from it). Use it as a **reference for patterns, not as code to copy wholesale**. In Phase 0, read at minimum:

- `CLAUDE.md`, `CONTENT_GUIDE.md`, `README.md`
- `src/db/storage.js` (versioning, `MIGRATIONS`, `migrate()`, export/import)
- `src/db/contentLoader.js` (`import.meta.glob` auto-discovery, user-added content merge)
- `src/srs/engine.js` (facets)
- `src/modules/grammar/exerciseRenderer.js` (exercise types, the trailing-`(...)` hint convention)
- `scripts/validate-content.js`, `content/schemas/*`, `.github/workflows/deploy.yml`, the service worker / PWA setup

Keep what works (static Vite + vanilla JS, schema-validated JSON content, auto-discovered content files, facet-based SRS, export/import backup, GitHub Actions deploy with a relative base path). Improve on it where this brief asks (lesson path, FSRS, storage namespacing, audio, games pulling from learned items).

## 5. Product spec

Mobile-first PWA, installable, fully offline after first load. Bottom tab bar with five tabs:

### 5.1 Today (the home screen)
- One big button: **Start today's lesson** (or "Continue" if half-done).
- A small honest progress line: lesson number / unit, reviews due, streak.
- If the review backlog is large, today's session becomes review-heavy automatically (see 5.2 budget) — the user does not have to decide.

### 5.2 The daily lesson (≤15 min, linear path)
Lessons are a fixed, ordered curriculum (section 8). One new lesson per day by default; the user may do an extra one, but the app shows a gentle note that reviews will grow.

Each lesson runs as a single guided flow, roughly:

| Step | Time | What happens |
|---|---|---|
| 1. Warm-up review | ~4 min | Due SRS cards (capped). Skipped if none due. |
| 2. Grammar point | ~2 min | One small idea, 2–4 short screens, an example table if useful, built so each screen fits a phone without scrolling much. |
| 3. New words | ~3 min | 6–10 new words introduced in context sentences, with audio if available. Each has an **"I already know this"** button: known words skip the learning steps and enter SRS with a longer first interval. |
| 4. Guided practice | ~4 min | 8–12 exercises mixing the new grammar point with the new words. |
| 5. Dialogue | ~2 min | A short, natural dialogue in one of the learner's contexts (family, media, UK life), with line-by-line English reveal and a "say it aloud" step. |

Time budget logic: the app estimates seconds per item and trims step 1 (and, if needed, step 4) so the total stays ≈15 min. Reviews that do not fit roll over; overdue reviews are spread over the next days rather than dumped at once. Daily review cap is a setting (default 60).

**On lesson completion, every new word, phrase and grammar exercise from that lesson is automatically added to the SRS deck and becomes available to the games.** No manual pack activation (this differs from the German app on purpose).

### 5.3 Review (Anki-style)
- FSRS scheduling (use the `ts-fsrs` npm package rather than hand-rolling SM-2). Four grading buttons: Again / Hard / Good / Easy, with the next interval shown on each button like Anki.
- Card facets per item type (section 7). Facets of the same word are not shown back-to-back in a session.
- Recognition (Urdu → English) and production (English → Urdu) are separate facets; production is weighted as the more important one, since the goal is speaking.
- Typed answers are checked with a **lenient normaliser**: case-folding, ignoring nasal and retroflex markings and doubled vowels for the match, ignoring punctuation. A lenient match counts as correct but shows the exact form with the differences highlighted. Free-translation answers (where Urdu word order is flexible) are self-graded: show the model answer(s), user marks right/wrong.

### 5.4 Games
All games draw **only from items the user has already learned** (introduced in a completed lesson), prioritising weak and recently-learned items. Start with:
1. **Match pairs** — tap Roman Urdu ↔ English pairs against a timer.
2. **Gender sort** — swipe/tap nouns into masculine/feminine.
3. **Sentence builder** — reorder word tiles into a correct sentence (accept every valid order listed in the content).
4. **Listen & pick** — hear a word or phrase (TTS), pick the meaning. Hidden when no Urdu voice is available.
5. **Agreement snap** — pick the correct form (e.g. `acchaa / acchii / acche`, `gayaa / gayii / gaye`) for a sentence.
6. **"Ne or no ne?"** — unlocked once the past-tense/ergative lesson is done: decide if the sentence needs `ne` and pick the verb agreement.

Game results feed back into SRS gently (a wrong answer in a game marks the facet as weak; games never push intervals further out).

### 5.5 Learn (library)
- **Grammar library**: every grammar point unlocked so far, readable any time, with its practice exercises.
- **Word list**: all learned words, searchable, filterable by unit / part of speech / "weak", tapping opens a word card with forms, examples, audio and a **"Report a mistake"** button.

### 5.6 Settings
- **Show Urdu script** toggle (off by default). When on, Urdu script (Nastaliq) is shown under the Roman Urdu everywhere. Use the Noto Nastaliq Urdu font via Google Fonts, cached by the service worker for offline use, with generous line-height.
- Audio on/off, speech rate, voice picker (only voices for `ur` locales).
- Daily review cap, new-lesson reminder of what's next.
- Export backup / Import backup (JSON, includes SRS, lesson progress, flags, settings, user-added items; import validates and migrates before writing, and asks before overwriting).
- **Export mistake reports** — downloads all "Report a mistake" flags as JSON so I can hand them to a future Claude Code session to fix the content.
- Erase all progress (prefixed keys only, double confirmation).

### 5.7 Audio and speaking
- Use the browser's `speechSynthesis` with an Urdu voice (`ur-PK` / `ur-IN`), speaking the **Urdu-script** field (TTS cannot read romanization correctly). Voice availability varies by device: detect it, and if there is no Urdu voice, hide audio buttons and show a one-time note in Settings — never fall back to an English or Hindi voice reading romanized text.
- Design the content schema with an optional `audio` field (path to a pre-recorded or pre-generated file) so recorded audio can be added later without a schema break; prefer the file when present.
- Speaking practice: "say it aloud" then reveal and self-grade. Add an optional **record & compare** button (MediaRecorder, stored in memory only, never saved) so I can hear myself next to the TTS.
- Do not rely on speech recognition for Urdu.

### 5.8 Visual design
Clean, calm, mobile-first; large tap targets (≥44px), one task per screen during lessons, light and dark themes following the system setting, readable at arm's length. Progress feedback should feel encouraging but honest (no fake XP inflation). Ask me for a colour direction in Phase 0 if you want one; otherwise choose something warm and understated.

## 6. Romanization scheme (fixed — enforce everywhere)

Readable for an English speaker, but it marks every sound that changes meaning. **Capital letters are phonetic only, never grammatical** — never capitalise the first word of a sentence or names in Roman Urdu fields.

| Sound | Write | Example |
|---|---|---|
| short a / i / u | a, i, u | ab, dil, tum |
| long aa / ii / uu | aa, ii, uu | aap, Thiik, huuN |
| e (ے) / ai | e, ai | mere, hai |
| o (و) / au | o, au | do, aur |
| nasal vowel (ں, nasalised) | N after the vowel | maiN, haiN, nahiiN, huuN |
| retroflex ٹ ڈ ڑ | T, D, R | Thiik, Dar, laRkaa |
| dental ت د | t, d | tum, das |
| ch (چ) / aspirated | ch; add h for aspiration | ch, chh, kh, gh, ph, bh, th, dh, Th, Dh, jh, Rh (chaay, khaanaa, ghar, bhaaii) |
| خ | x | xush, xabar |
| غ | Gh | Ghalat |
| ق | q | qariib |
| ش | sh | shukriyaa |
| ز ذ ض ظ | z | zaruur |
| س ص ث | s | sab |
| ح ہ | h | hai |
| و consonant | w | wo, waqt |
| ی consonant | y | yahaaN |
| ع | omit | |

Notes:
- Doubled consonants are written double: `pakkaa`, `bacchaa`, `acchaa` (اچھا — the aspirated doubled ch is written `cch`).
- "I'm fine" is written **`maiN Thiik huuN`**.
- Write this table into `content/ROMANIZATION.md` in Phase 1, including at least 40 worked examples across the scheme, and make the validator reject Roman Urdu fields containing capitals other than `T D R N` and `G` (only as `Gh`), or characters outside the scheme. Before finalising it, list any words where you think the scheme is awkward and ask me.

## 7. Content model

Content is versioned JSON in the repo, auto-discovered via `import.meta.glob` (no manifest), each type with a JSON Schema (draft-07) in `content/schemas/`, validated by `npm run validate` (which also runs before `npm run build`). Every file's `id` matches its filename.

```
content/
  ROMANIZATION.md
  CURRICULUM.md            # the full unit/lesson outline (Phase 0 output, kept up to date)
  schemas/
  units/unit-01/
    unit.json              # unit title, CEFR level, can-do goals
    vocab.json             # all words introduced in this unit
    lesson-001.json ...    # lessons reference vocab ids and contain grammar + exercises + dialogue
```

### 7.1 Every Urdu text field comes in pairs
Any Urdu sentence or word is stored as `roman` + `ur` (Urdu script) + `en`. Never store Roman Urdu alone.

### 7.2 Word fields
Common (required): `id` (kebab-case from the romanization, e.g. `laRkaa` → `larkaa`; unique across the whole app), `pos` (`noun` / `verb` / `adjective` / `adverb` / `postposition` / `pronoun` / `phrase` / `other`), `roman`, `ur`, `meaning_en`, `example` `{roman, ur, en}`, `register` (`informal` / `neutral` / `formal`), `introduced_in` (lesson id).
Optional: `notes`, `hindi_variant` (when common film/TV Hindi uses a different word, e.g. `shukriyaa` vs `dhanyavaad`), `audio`, `forms` (list of inflected forms used in the lesson sentences, for the coverage checker).

- **Nouns:** `gender` (`m` / `f`), `marked` (true for masculine `-aa` nouns that inflect: `laRkaa / laRke / laRkoN`), `plural`, `oblique_pl`. Facets: `meaning_ur_en`, `meaning_en_ur`, `gender`.
- **Verbs:** `infinitive`, `stem`, `transitivity` (`intransitive` / `transitive`), `takes_ne` (boolean — must be stated explicitly; exceptions like `laanaa` matter), `perfective` `{m_sg, f_sg, m_pl}` (critical for irregulars: `jaanaa → gayaa`, `karnaa → kiyaa`, `denaa → diyaa`, `lenaa → liyaa`, `honaa → huaa`, `piinaa → piyaa`). Facets: `meaning_ur_en`, `meaning_en_ur`, `perfective` (once the past tense is unlocked), `takes_ne` (once `ne` is unlocked).
- **Adjectives:** `variable` (true for `-aa` adjectives that agree: `acchaa / acchii / acche`). Facets: `meaning_ur_en`, `meaning_en_ur`.
- **Phrases** (greetings, set expressions, politeness formulas): facets `meaning_ur_en`, `situation_to_phrase`.

Facets that test grammar the learner hasn't reached yet stay dormant until the unlocking lesson is completed.

### 7.3 Lesson fields
`id`, `unit`, `order`, `title`, `can_do` (one sentence: "You can say what you ate yesterday"), `grammar` (sections with `heading`, `body`, optional `table`), `new_vocab` (array of vocab ids, 6–10), `exercises` (8–12), `dialogue` (lines with `speaker`, `roman`, `ur`, `en`), `context` (`family` / `media` / `uk-life`).

### 7.4 Exercise types
Reuse the German app's five types and conventions (`fill-blank` with required English translation, `multiple-choice`, `choose-form`, `reorder`, `error-spot`, trailing `(...)` hints hidden behind a Hint button), and add:
- `translate` — English → Urdu, with `answers` (array: every acceptable phrasing/word order) and self-grade fallback.
- `transform` — change a sentence (present → past, `tum` → `aap`, singular → plural).
- `listen` — audio prompt, multiple choice (skipped automatically when no Urdu voice).
`reorder` must list every valid order in `answerOrders` (Urdu word order is flexible).
Every exercise is its own SRS card after the lesson is completed.

### 7.5 Coverage checker
`npm run check-coverage` (warning-level, not a build blocker): for each lesson, tokenises its sentences and lists tokens that are neither introduced in this or an earlier lesson (including their `forms`) nor in a small allowlist of function words. The aim is that lessons only use what has been taught, plus the new words.

## 8. Curriculum

In Phase 0, write `content/CURRICULUM.md`: the full path from A1 to low B2, as ~18 units of ~10 lessons (≈180 lessons, ≈1,500 core words plus phrases), each unit ending with a review lesson. Order grammar for **speaking usefulness**, roughly:

1. Greetings, respect and `aap / tum / tuu`, `jii`, `hai / haiN / huuN` (`honaa` present)
2. Nouns and gender, marked/unmarked nouns, `-aa / -ii` patterns, plurals
3. Possession with `kaa / kii / ke`, possessive pronouns (`meraa`, `aapkaa`...)
4. Postpositions (`meN`, `par`, `se`, `tak`, `ko`) and the oblique case
5. Adjective agreement; `yeh / wo`, `kyaa`, question words
6. Present habitual (`maiN khaataa huuN`)
7. Present progressive (`rahaa hai`)
8. Imperatives and requests at three politeness levels
9. Future (`gaa / gii / ge`)
10. `mujhe ... chaahiye`, `mujhe ... pasand hai`, other dative-subject constructions
11. Past (perfective) of intransitive verbs; `thaa / thii / the`
12. Past of transitive verbs and **`ne`** with object agreement
13. `saknaa`, `paanaa`, `chuknaa`, `lagnaa`
14. Compound verbs (`le lenaa`, `de denaa`, `ho jaanaa`, `kar lenaa`)
15. Conjunctive participle (`khaa kar`), sequencing stories
16. Subjunctive, `agar ... to` conditionals, wishes
17. Relative–correlative clauses (`jo ... wo`), reported speech
18. Causatives, passives, and natural spoken features (English code-switching in UK/Pakistani speech, fillers, softeners)

Vocabulary and dialogues are chosen for the learner's three contexts: family and hospitality (relatives and kinship terms, food, visiting, respect with elders, celebrations), films/music/media (emotions, relationships, common lyric and dialogue vocabulary, and Hindi–Urdu differences via `hindi_variant`), and UK community life (small talk, work, shopping, GP, transport, weather). Target everyday spoken Pakistani Urdu; flag very formal Persian/Arabic-heavy words as `formal`.

**Unit 1 must assume the learner knows some greetings and family words but no grammar**, and use the "I already know this" button to move fast through familiar vocabulary.

## 9. Tech and deployment

- Vite + vanilla JS (ES modules), no framework, no backend, matching the German app. JSDoc types where helpful.
- `npm run dev / validate / check-coverage / test / build / preview`, tests on Node's built-in test runner.
- Deploy to GitHub Pages via GitHub Actions on push to `main`, relative base path.
- PWA: manifest, icons, service worker with versioned, **prefixed** cache names. When a new version is deployed, show a small "Update available — reload" banner; updating must never touch storage. Request `navigator.storage.persist()` on first run.
- Storage: `src/db/storage.js` with `STORAGE_VERSION`, `MIGRATIONS`, additive `migrate()`, export/import, all keys prefixed, unit-tested (including a test that a v1 snapshot survives every future migration — keep fixture snapshots in `tests/fixtures/` and add one whenever the version bumps).

## 10. Tests that must exist

- Storage: migrations, prefixing, export/import round-trip, corrupt-data handling (no wipe), erase only touches prefixed keys.
- SRS: FSRS scheduling wiring, facet unlocking, daily cap, backlog spreading, "already know" path.
- Lesson scheduler: time budget, unlock order, adding lesson items to the deck on completion.
- Answer normaliser: lenient vs exact matches across the romanization scheme.
- Validator: rejects bad romanization, missing `ur`, missing verb `perfective`/`takes_ne`, duplicate ids, references to unknown vocab ids.

## 11. Build phases (stop after each)

**Phase 0 — Plan (no app code yet).** Read the reference app files listed in section 4 and this brief. Then write `PLAN.md` (architecture, module layout, storage shape and key prefix, SRS facet design, lesson-player state machine, game design), `content/CURRICULUM.md` (full outline per section 8, with every lesson's title, grammar point, can-do statement and topic), and a draft of `content/ROMANIZATION.md`. List open questions. Stop.

**Phase 1 — Foundations.** Scaffold the project, storage layer with migrations and tests, content loader, schemas and validator (with romanization rules), PWA + service worker, GitHub Actions deploy, `CLAUDE.md` (data-safety rules adapted from the German app, plus the shared-origin namespacing rule), `README.md`. Stop.

**Phase 2 — SRS + Review.** FSRS engine with facets, Review screen, answer normaliser, tests. Stop.

**Phase 3 — Lesson player + Unit 1, lessons 1–5 only.** Today screen, full lesson flow, auto-adding items to the deck, TTS with voice detection, script toggle. Generate content for lessons 1–5 only, run validate and coverage, re-check every gender and verb form by hand, and list any Urdu you're less than certain about. Stop so I can use it on my phone for a few days.

**Phase 4 — Games.** The six games in 5.4, pulling only from learned items. Stop.

**Phase 5 — Library + Settings.** Grammar library, word list, mistake reporting and export, all settings in 5.6, export/import UI. Stop.

**Phase 6 — Content pipeline docs.** Write `CONTENT_GUIDE.md` (modelled on the German one): how to generate the next unit, the one-unit-per-pass rule, the manual accuracy checklist, how to process an exported mistake-report file, and a ready-to-paste prompt for "generate unit N". Then finish Unit 1 (lessons 6–10). Stop.

**Phase 7 — Script track (optional).** An optional Urdu-script track in the Learn tab that never blocks daily lessons: about 12 lessons of ~10 minutes, teaching shapes in Naskh first and finishing with Nastaliq. Practice types are script→Roman reading with already-learned words, spelling with letter tiles, finger tracing (self-checked) and a letter-match game, with a separate script SRS deck and a "Practise script" button. It includes an alphabet reference chart stored as content (`content/script/alphabet.json`). Each unit's review lesson ends with a skippable "next Script lesson" suggestion. Full design in `PLAN.md` §13; the Phase 1 storage already has slots for it. Stop.

After Phase 6, new content is added one unit per session using `CONTENT_GUIDE.md`; Phase 7 can be built in between those sessions.

## 12. Definition of done for any phase

`npm run validate`, `npm run test`, and `npm run build` all pass; the app runs on a phone-width viewport without horizontal scroll; no change touches stored data without a migration; you've told me what you're unsure about.
