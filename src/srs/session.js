// One review session over a fixed queue. Pure state, no DOM.
//
// A card that is graded into Learning/Relearning and falls due again before the day ends waits
// (shown after its step has elapsed) instead of reappearing instantly. When nothing else is
// left, the caller can wait for it or study it now.

import { insertSpaced, studyDayEnd } from './queue.js';
import { CARD_STATE } from './fsrs.js';

/** @param {string[]} queue */
export function createSession(queue) {
  return { queue: [...queue], waiting: [] /* { id, due } */, reviewed: 0 };
}

/**
 * The next card to show.
 * @returns {{ id: string } | { wait: number } | null}  wait = epoch ms the earliest waiting card is due; null = finished
 */
export function nextCard(session, now) {
  const ready = session.waiting.filter((w) => w.due <= now).sort((a, b) => a.due - b.due);
  for (const w of ready) {
    session.waiting.splice(session.waiting.indexOf(w), 1);
    insertSpaced(session.queue, w.id, 0);
  }
  if (session.queue.length) return { id: session.queue[0] };
  if (session.waiting.length) return { wait: Math.min(...session.waiting.map((w) => w.due)) };
  return null;
}

/** Bring every waiting card forward ("study now"). */
export function releaseWaiting(session) {
  for (const w of session.waiting.splice(0)) insertSpaced(session.queue, w.id, 0);
}

/** Record that the front card was graded; `card` is its new state. */
export function afterGrade(session, id, card, { now, rolloverHour = 4 }) {
  const i = session.queue.indexOf(id);
  if (i !== -1) session.queue.splice(i, 1);
  session.reviewed++;
  const learning = card.st === CARD_STATE.learning || card.st === CARD_STATE.relearning;
  if (learning && card.due < studyDayEnd(now, rolloverHour)) session.waiting.push({ id, due: card.due });
}

export const remaining = (session) => session.queue.length + session.waiting.length;
