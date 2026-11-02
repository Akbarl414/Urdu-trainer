// ts-fsrs wrapper and compact card adapter. THIS IS THE ONLY MODULE THAT IMPORTS ts-fsrs
// (PLAN §2), so the library can be upgraded or swapped without touching anything else.
//
// A CompactCard is what lives in storage (PLAN §3.2; short keys because the deck is large
// and localStorage is shared with the German app):
//   { due, s, d, st, r, l, lr, sd, ls, weak? }
//   due epoch ms · s stability · d difficulty · st state (0 New, 1 Learning, 2 Review, 3 Relearning)
//   r reps · l lapses · lr last review (ms or null) · sd scheduled days · ls learning step
//   weak epoch ms when a game marked it weak (cleared by the next real review)
//
// Scheduling (PLAN §5.3, D16): two instances. Production facets (saying/writing Urdu) use
// request_retention 0.90, recognition and form facets 0.85, so production comes back more often.
//
// ts-fsrs 6 marks the classic fsrs()/repeat()/next() API deprecated in favour of
// DefaultScheduler; the classic API is still exported and stable, and being confined to this
// file makes a later switch a one-file change.

import { fsrs, generatorParameters, createEmptyCard, Rating, State } from 'ts-fsrs';

export const GRADE = Object.freeze({ again: 1, hard: 2, good: 3, easy: 4 });
export const GRADES = [GRADE.again, GRADE.hard, GRADE.good, GRADE.easy];
export const CARD_STATE = Object.freeze({ new: 0, learning: 1, review: 2, relearning: 3 });

export const RETENTION = Object.freeze({ production: 0.9, recognition: 0.85 });
const PRODUCTION_FACETS = new Set(['meaning_en_ur', 'situation_to_phrase']);
/** "Already know this": Easy twice, this far apart (internal, never shown). */
const KNOWN_GAP_MS = 60 * 1000;
const DAY_MS = 86400000;

export const isProductionFacet = (facet) => PRODUCTION_FACETS.has(facet);

const RATING = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy };

function toFsrs(c) {
  return {
    due: new Date(c.due),
    stability: c.s,
    difficulty: c.d,
    elapsed_days: 0,
    scheduled_days: c.sd,
    reps: c.r,
    lapses: c.l,
    learning_steps: c.ls,
    state: c.st,
    last_review: c.lr == null ? undefined : new Date(c.lr),
  };
}

function fromFsrs(card, weak) {
  const out = {
    due: card.due.getTime(),
    s: card.stability,
    d: card.difficulty,
    st: card.state,
    r: card.reps,
    l: card.lapses,
    lr: card.last_review ? card.last_review.getTime() : null,
    sd: card.scheduled_days,
    ls: card.learning_steps,
  };
  if (weak) out.weak = weak;
  return out;
}

/** @param {{ fuzz?: boolean }} [opts]  fuzz spreads intervals so lessons don't create review clumps; tests turn it off. */
export function createEngine({ fuzz = true } = {}) {
  const make = (retention) => fsrs(generatorParameters({ request_retention: retention, enable_fuzz: fuzz }));
  const engines = { production: make(RETENTION.production), recognition: make(RETENTION.recognition) };
  const pick = (facet) => engines[isProductionFacet(facet) ? 'production' : 'recognition'];

  /** A brand-new card, due immediately. */
  function newCard(now) {
    return fromFsrs(createEmptyCard(new Date(now)));
  }

  /** What each button would schedule: { 1: { due, ms }, 2: …, 3: …, 4: … } (ms = time from `now`). */
  function preview(card, facet, now) {
    const log = pick(facet).repeat(toFsrs(card), new Date(now));
    const out = {};
    for (const g of GRADES) {
      const due = log[RATING[g]].card.due.getTime();
      out[g] = { due, ms: Math.max(0, due - now) };
    }
    return out;
  }

  /** Apply a grade. Returns a NEW card; a game's `weak` mark is cleared by a real review. */
  function review(card, facet, grade, now) {
    if (!RATING[grade]) throw new Error(`Invalid grade: ${grade}`);
    const next = pick(facet).next(toFsrs(card), new Date(now), RATING[grade]);
    return fromFsrs(next.card);
  }

  /** Probability of recalling the card at `now`; New cards report 0. */
  function retrievability(card, facet, now) {
    if (card.st === CARD_STATE.new) return 0;
    return pick(facet).retrievability(toFsrs(card), new Date(now));
  }

  /** "I already know this": Easy twice about a minute apart, for a first interval of roughly 1–3 weeks. */
  function alreadyKnow(card, facet, now) {
    const once = review(card, facet, GRADE.easy, now);
    return review(once, facet, GRADE.easy, now + KNOWN_GAP_MS);
  }

  return { newCard, preview, review, retrievability, alreadyKnow };
}

export const engine = createEngine();
export const { newCard, preview, review, retrievability, alreadyKnow } = engine;

/**
 * A game answer was wrong (PLAN §5.6). Marks the card weak and, if it was due further
 * out than `dayEnd`, pulls it back to `dayEnd`. Never calls the scheduler and never pushes a due date later.
 */
export function markWeak(card, now, dayEnd) {
  const out = { ...card, weak: now };
  if (card.st === CARD_STATE.review && card.due > now + DAY_MS) out.due = Math.min(card.due, dayEnd);
  return out;
}

/** Anki-style interval label: 10m · 5h · 9d · 2.4mo · 1.1y. */
export function formatInterval(ms) {
  const trim = (n) => String(Math.round(n * 10) / 10);
  const minutes = ms / 60000;
  if (minutes < 1) return '<1m';
  if (Math.round(minutes) < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (Math.round(hours) < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (Math.round(days) < 31) return `${Math.round(days)}d`;
  const months = days / 30.4375;
  if (months < 11.95) return `${trim(months)}mo`;
  return `${trim(days / 365.25)}y`;
}
