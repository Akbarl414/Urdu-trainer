# Urdu Trainer

A personal spoken-Urdu trainer: a short daily lesson (≤15 minutes), spaced-repetition review and games, taking one learner from A1 to low B2. It's a static, installable, offline-capable PWA (Vite + vanilla JS, no backend). Progress lives only on the device, so the app has export/import backups.

Start with [BRIEF.md](./BRIEF.md) (the product), [PLAN.md](./PLAN.md) (the design and decisions), [content/CURRICULUM.md](./content/CURRICULUM.md) and [content/ROMANIZATION.md](./content/ROMANIZATION.md). Rules for working in the repo are in [CLAUDE.md](./CLAUDE.md).

**Status:** Phase 1 (foundations): storage layer, content loader/schemas/validator, PWA shell and deploy, voice test page. No lessons yet (Unit 1 arrives in Phase 3).

## Run it

Needs Node 22 or newer (see `.nvmrc`; CI uses 22).

```sh
npm install
npm run dev          # http://localhost:5173
npm run dev -- --host   # also reachable from your phone on the same Wi-Fi
```

The service worker is disabled in `dev`. To try the installable/offline build:

```sh
npm run build && npm run preview     # http://localhost:4173
```

| Command | What it does |
|---|---|
| `npm run dev` / `preview` | dev server / serve the production build |
| `npm run validate` | schemas, romanization, Urdu code points, id rules, id lockfile |
| `npm run lock-ids` | record all current content ids in `content/shipped-ids.json` (`-- --check` fails if any are unlocked) |
| `npm test` | all tests (Node's built-in runner) |
| `npm run build` | validate, then build to `dist/` |
| `npm run icons` | regenerate `public/icons/*.png` (needs `rsvg-convert`) |

## Review (Phase 2)

`#/review` is the Anki-style review screen: Again / Hard / Good / Easy with the next interval on each button (FSRS via `ts-fsrs`). Production cards (English → Urdu) default to **Speak** (say it, reveal, grade yourself) with a **Type** toggle that checks your Roman Urdu leniently (`theek`, `hoon`, `mein` count, `laRkii` for `laRkaa` never does). Recognition cards just reveal.

No lessons exist yet, so to try it: open `#/debug/seed` (or **Add or remove test cards** on the home screen), tap **Add test cards**, then **Open Review**. **Make them all due now** resets the test cards' schedules for another go; **Remove test cards** deletes only the `seed-…` cards. On a phone: `npm run dev -- --host`, then open the `Network:` address it prints (the phone has its own storage, separate from your computer).

## Voice test page

Open `#/debug/voices` (e.g. `http://localhost:5173/#/debug/voices`, or the **Voice test** button on the home screen). It lists every text-to-speech voice the device offers, highlights Urdu ones (`ur`, `ur-PK`, `ur-IN`), has a "speak" button for each, and a **Copy report** button. Run it on your iPhone to find out whether an Urdu voice exists. It also has a **Hindi fallback** box: type Roman Urdu, see the Devanagari it becomes, and hear a Hindi voice read it (the fallback used when a device has no Urdu voice, PLAN D13).

## Deploying to GitHub Pages

Pushing to `main` runs `.github/workflows/deploy.yml` (tests → id-lock check → build → Pages). One-time setup on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The site appears at `https://<username>.github.io/<repo>/`. The build uses a relative base path, so no config is needed for the repo name.

## Your data

Everything is in the browser's `localStorage` under keys starting `urdu-trainer:` (the German app shares the origin, so nothing here touches any other key). Back up regularly from Settings → Export (Phase 5). If stored data ever can't be read safely, the app stops on a recovery screen instead of overwriting it.

## Layout

```
src/db/      storage, keys, study-day, content loader  (stable contract)
src/lang/    romanization rules (shared with the validator)
src/audio/   Urdu voice detection
src/sw/      service worker template
src/ui/, src/modules/   screens and components (free to redesign)
content/     schemas, units, ROMANIZATION.md, CURRICULUM.md, shipped-ids.json  (stable contract)
scripts/     validate-content, lock-ids, make-icons
tests/       node --test, with storage snapshots in tests/fixtures/
```
