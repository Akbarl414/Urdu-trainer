import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earnsGameCredit, GAME_CREDIT_FORMATS } from '../src/srs/gameCredit.js';
import { CARD_STATE } from '../src/srs/fsrs.js';

const DAY = 86400000;
const NOW = Date.parse('2026-11-02T10:00:00Z');
// A 10-day interval: last reviewed 9 days ago, due tomorrow, so 10% of the interval is left.
const near = { st: CARD_STATE.review, lr: NOW - 9 * DAY, due: NOW + DAY };
const ok = (card, format = 'typed', day = '2026-11-02') => earnsGameCredit({ card, format, now: NOW, day });

test('only recall formats earn credit, never picking from options', () => {
  for (const f of GAME_CREDIT_FORMATS) assert.equal(ok(near, f), true, f);
  for (const f of ['multiple-choice', 'choice', 'two-option', 'match', 'tiles']) assert.equal(ok(near, f), false, f);
});

test('only Review-state cards earn credit', () => {
  for (const st of [CARD_STATE.new, CARD_STATE.learning, CARD_STATE.relearning]) assert.equal(ok({ ...near, st }), false, String(st));
  assert.equal(ok({ ...near, retired: true }), false);
});

test('due, or within 20% of the interval from being due', () => {
  assert.equal(ok({ ...near, lr: NOW - 11 * DAY, due: NOW - DAY }), true, 'overdue');
  assert.equal(ok({ ...near, lr: NOW - 8 * DAY, due: NOW + 2 * DAY }), true, 'exactly 20% left');
  assert.equal(ok({ ...near, lr: NOW - 7 * DAY, due: NOW + 3 * DAY }), false, '30% left');
});

test('at most one credit per card per study day', () => {
  assert.equal(ok({ ...near, gc: '2026-11-02' }), false);
  assert.equal(ok({ ...near, gc: '2026-11-01' }), true);
});
