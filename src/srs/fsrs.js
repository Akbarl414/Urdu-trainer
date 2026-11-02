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
// desired retention 0.90, recognition and form facets 0.85, so production comes back more often.
//
// Uses ts-fsrs's current DefaultScheduler API, pinned to the FSRS-6 model (its default is FSRS-7,
// which would change every interval). The scheduler is created asynchronously, so this module
// awaits it once at load (top-level await). The stored CompactCard shape is independent of the
// library's own card fields: toFsrs()/fromFsrs() translate, so upgrading the library never
// touches stored data.

import { DefaultScheduler } from 'ts-fsrs';

export const GRADE = Object.freeze({ again: 1, hard: 2, good: 3, easy: 4 });
export const GRADES = [GRADE.again, GRADE.hard, GRADE.good, GRADE.easy];
export const CARD_STATE = Object.freeze({ new: 0, learning: 1, review: 2, relearning: 3 });

export const RETENTION = Object.freeze({ production: 0.9, recognition: 0.85 });
const PRODUCTION_FACETS = new Set(['meaning_en_ur', 'situation_to_phrase']);
/** "Already know this": Easy twice, this far apart (internal, never shown). */
const KNOWN_GAP_MS = 60 * 1000;
const DAY_MS = 86400000;

export const isProductionFacet = (facet) => PRODUCTION_FACETS.has(facet);

// The library's schedule status has three values; Relearning is state 3 with status 'learning'.
const STATUS = ['new', 'learning', 'review', 'learning'];
/** Fuzz is seeded by the card id, so cards without one share a seed (fine for tests and previews). */
const NO_ID = 'card';

function toFsrs(c, cardId = NO_ID) {
  return {
    stability: c.s,
    difficulty: c.d,
    state: c.st,
    scheduleStatus: STATUS[c.st],
    cardId,
    dueAt: new Date(c.due),
    lastReviewAt: c.lr == null ? null : new Date(c.lr),
    reps: c.r,
    lapses: c.l,
    scheduledDays: c.sd,
    learningStep: c.ls,
  };
}

function fromFsrs(card, weak) {
  const out = {
    due: card.dueAt.getTime(),
    s: card.stability,
    d: card.difficulty,
    st: card.state,
    r: card.reps,
    l: card.lapses,
    lr: card.lastReviewAt ? card.lastReviewAt.getTime() : null,
    sd: card.scheduledDays,
    ls: card.learningStep,
  };
  if (weak) out.weak = weak;
  return out;
}

/** @param {{ fuzz?: boolean }} [opts]  fuzz spreads intervals so lessons don't create review clumps; tests turn it off. */
export async function createEngine({ fuzz = true } = {}) {
  const make = (desiredRetention) => DefaultScheduler({ version: 'FSRS-6', desiredRetention, enableFuzz: fuzz });
  const engines = { production: await make(RETENTION.production), recognition: await make(RETENTION.recognition) };
  const pick = (facet) => engines[isProductionFacet(facet) ? 'production' : 'recognition'];

  /** A brand-new card, due immediately. */
  function newCard(now) {
    return fromFsrs(engines.recognition.newCard({ now: new Date(now) }));
  }

  /** What each button would schedule: { 1: { due, ms }, 2: …, 3: …, 4: … } (ms = time from `now`). */
  function preview(card, facet, now, cardId) {
    const out = {};
    for (const item of pick(facet).preview({ card: toFsrs(card, cardId), now: new Date(now) })) {
      const due = item.card.dueAt.getTime();
      out[item.grade] = { due, ms: Math.max(0, due - now) };
    }
    return out;
  }

  /** Apply a grade. Returns a NEW card; a game's `weak` mark is cleared by a real review. */
  function review(card, facet, grade, now, cardId) {
    if (!GRADES.includes(grade)) throw new Error(`Invalid grade: ${grade}`);
    return fromFsrs(pick(facet).review({ card: toFsrs(card, cardId), now: new Date(now), grade }).card);
  }

  /** Probability of recalling the card at `now`; New cards report 0. Elapsed time is whole days, as in the classic API. */
  function retrievability(card, facet, now) {
    if (card.st === CARD_STATE.new) return 0;
    const elapsedDays = card.lr == null ? 0 : Math.max(0, Math.floor((now - card.lr) / DAY_MS));
    return pick(facet).model.forgettingCurve({ stability: card.s, difficulty: card.d }, elapsedDays);
  }

  /** "I already know this": Easy twice about a minute apart, for a first interval of roughly 1–3 weeks. */
  function alreadyKnow(card, facet, now, cardId) {
    const once = review(card, facet, GRADE.easy, now, cardId);
    return review(once, facet, GRADE.easy, now + KNOWN_GAP_MS, cardId);
  }

  return { newCard, preview, review, retrievability, alreadyKnow };
}

export const engine = await createEngine();
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
