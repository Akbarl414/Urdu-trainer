import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TZ = 'Europe/London';
const { studyDay, previousDay } = await import('../src/db/day.js');

test('study day rolls over at 04:00 local time (BST)', () => {
  // 2026-07-01 00:30 BST = 2026-06-30 23:30Z
  assert.equal(studyDay(Date.parse('2026-06-30T23:30:00Z')), '2026-06-30');
  // 03:59 BST still belongs to the previous day; 04:00 BST starts the new one
  assert.equal(studyDay(Date.parse('2026-07-01T02:59:00Z')), '2026-06-30');
  assert.equal(studyDay(Date.parse('2026-07-01T03:00:00Z')), '2026-07-01');
});

test('winter time (GMT) uses the same local rule', () => {
  assert.equal(studyDay(Date.parse('2026-12-01T03:59:00Z')), '2026-11-30');
  assert.equal(studyDay(Date.parse('2026-12-01T04:00:00Z')), '2026-12-01');
});

test('rollover hour is configurable', () => {
  assert.equal(studyDay(Date.parse('2026-12-01T05:30:00Z'), 6), '2026-11-30');
  assert.equal(studyDay(Date.parse('2026-12-01T05:30:00Z'), 0), '2026-12-01');
});

test('previousDay handles month, year and DST boundaries', () => {
  assert.equal(previousDay('2026-03-01'), '2026-02-28');
  assert.equal(previousDay('2027-01-01'), '2026-12-31');
  assert.equal(previousDay('2026-03-29'), '2026-03-28'); // UK clocks go forward
  assert.equal(previousDay('2026-10-26'), '2026-10-25'); // UK clocks go back the day before
});
