import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCoverage, wordTokens } from '../scripts/lib/coverage.js';
import { makeBundle } from './helpers/contentFixture.js';

const raw = (b) => ({ vocabs: b.vocabs.map((v) => v.data), lessons: b.lessons.map((l) => l.data) });
const lesson = (b) => b.lessons[0].data;
const unknownOf = (b, allow = {}) => checkCoverage(raw(b), allow)[0].unknown.map((u) => u.token);
// The fixture lesson uses huuN / hai / haiN / Thiik / maiN etc. without teaching them all as vocab.
const ALLOW = { from_lesson: { 'lesson-001': ['maiN', 'Thiik', 'huuN', 'hai', 'haiN', 'tum', 'ho', 'aap', 'ye', 'wo', 'yahaaN', 'bahut', 'meraa', 'ghar', 'jaataa', 'assalaam', 'o', 'alaikum', 'wa', 'gayaa', 'gayii'] } };

test('a lesson that only uses taught words and allowlisted tokens is clean', () => {
  assert.deepEqual(unknownOf(makeBundle(), ALLOW), []);
});

test('untaught tokens are reported with where they first appear; blanks and punctuation are ignored', () => {
  const b = makeBundle();
  lesson(b).dialogue.lines[0].roman = 'assalaam-o-alaikum, chaachaa jii!';
  const report = checkCoverage(raw(b), ALLOW)[0].unknown;
  assert.deepEqual(report.map((u) => u.token), ['chaachaa', 'jii']);
  assert.match(report[0].where, /^dialogue\.lines\[0\]\.roman$/);
  assert.ok(!unknownOf(makeBundle(), ALLOW).includes('___'));
});

test('names and later-lesson allowlist entries', () => {
  const b = makeBundle();
  lesson(b).dialogue.lines[0].roman = 'saarah, assalaam-o-alaikum!';
  assert.deepEqual(unknownOf(b, ALLOW), ['saarah']);
  assert.deepEqual(unknownOf(b, { ...ALLOW, names: ['saarah'] }), []);
  assert.deepEqual(unknownOf(b, { from_lesson: { ...ALLOW.from_lesson, 'lesson-002': ['saarah'] } }), ['saarah'], 'not yet allowed in lesson-001');
});

test('a word makes its forms, plurals and agreement forms known, but not its perfective', () => {
  const b = makeBundle();
  const words = b.vocabs[0].data.words;
  assert.deepEqual(wordTokens(words.find((w) => w.id === 'larkaa')), ['laRkaa', 'laRke', 'laRkoN']);
  assert.deepEqual(wordTokens(words.find((w) => w.id === 'acchaa')), ['acchaa', 'acchaa', 'acchii', 'acche']);
  assert.ok(!wordTokens(words.find((w) => w.id === 'jaanaa')).includes('gayaa'));
});

test('example sentences of the words a lesson introduces are covered too', () => {
  const b = makeBundle();
  b.vocabs[0].data.words.find((w) => w.id === 'kitaab').example.roman = 'kitaab mez par hai.';
  const report = checkCoverage(raw(b), ALLOW)[0].unknown;
  assert.deepEqual(report.map((u) => u.token), ['mez', 'par']);
  assert.match(report[0].where, /^vocab kitaab\.example/);
});
