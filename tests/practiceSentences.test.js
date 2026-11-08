// Practice sentences (PLAN D36) and the Unit 1 "no Script suggestion yet" guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAjv, loadContent, CONTENT_ROOT } from '../scripts/lib/content.js';
import { checkContent, collectIds } from '../scripts/lib/check.js';
import { checkCoverage } from '../scripts/lib/coverage.js';
import { makeBundle } from './helpers/contentFixture.js';
import { realContent } from './helpers/realContent.js';
import { defaultData } from '../src/db/storage.js';
import { syncDeck } from '../src/srs/deck.js';
import { sentencePool, listenPracticePool } from '../src/games/pool.js';
import { poolFor } from '../src/games/catalog.js';
import { applyAnswer } from '../src/games/outcome.js';
import { practiceTiles, practiceOrders } from '../src/games/practice.js';
import { isOrderRight } from '../src/games/answers.js';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const DAY = 86400000;
const content = realContent();
const ajv = createAjv();
const run = (bundle) => checkContent(bundle, { ajv, shippedIds: [] });
const failsWith = (b, pattern) => {
  const { errors } = run(b);
  assert.ok(errors.some((e) => pattern.test(e)), `expected ${pattern}, got:\n${errors.join('\n') || '(none)'}`);
};
const SIX = (extra = {}) => ['aap Thiik haiN?', 'ye bhii Thiik hai.', 'aap bhii Thiik haiN?', 'wo bhii Thiik hai.', 'ham bhii Thiik haiN.', 'tum bhii Thiik ho.'].map((roman, i) => ({ id: `p0${i + 1}`, roman, ur: 'آپ', en: 'x', ...extra }));

function deviceAfter(n, { at = NOW - 30 * DAY, gender = null } = {}) {
  const data = defaultData(at);
  data.settings.learnerGender = gender;
  for (const l of content.lessons.slice(0, n)) data.progress.lessons[l.id] = { firstCompletedAt: at, lastCompletedAt: at, timesCompleted: 1, knownWordIds: [] };
  syncDeck(data, content, at);
  return data;
}

test('Lessons 1-10 each have 6-8 practice sentences of 3-8 tiles', () => {
  for (const l of content.lessons.filter((x) => x.order <= 10)) {
    assert.ok(l.practice_sentences?.length >= 6 && l.practice_sentences.length <= 8, l.id);
    for (const p of l.practice_sentences) {
      const n = practiceTiles(p.roman).length;
      assert.ok(n >= 3 && n <= 8, `${l.id}/${p.id}`);
    }
  }
});

test('practice sentences use only Urdu taught up to and including their lesson', () => {
  const bundle = loadContent();
  const allow = JSON.parse(readFileSync(join(CONTENT_ROOT, 'coverage-allowlist.json'), 'utf8'));
  const report = checkCoverage({ vocabs: bundle.vocabs.map((v) => v.data), lessons: bundle.lessons.map((l) => l.data) }, allow);
  const practiceGaps = report.flatMap((r) => r.unknown.filter((u) => u.where.startsWith('practice_sentences')));
  assert.deepEqual(practiceGaps, []);
});

test('a practice sentence never becomes a card, and a game answer on one changes nothing', () => {
  const data = deviceAfter(10);
  const ids = Object.keys(data.srs.decks.main.cards);
  assert.equal(ids.filter((id) => /:p\d\d/.test(id)).length, 0, 'no card ids contain a practice id');
  const before = JSON.stringify(data.srs);
  for (const item of [...sentencePool(data, content, NOW).filter((p) => p.practice), ...listenPracticePool(data, content, NOW)]) {
    assert.equal(item.cardId, null);
    for (const correct of [true, false]) {
      const out = applyAnswer(data, { cardId: item.cardId, correct, format: 'listening', now: NOW });
      assert.deepEqual(out, { credited: false, weak: false });
    }
  }
  assert.equal(JSON.stringify(data.srs), before);
});

test('existing ids are unchanged: practice sentences only add new, namespaced ones', () => {
  const ids = collectIds(loadContent());
  const practice = [...ids].filter((id) => id.startsWith('practice:'));
  assert.ok(practice.length >= 60);
  assert.ok(practice.every((id) => /^practice:lesson-\d{3}\/p\d{2}$/.test(id)));
});

test('Sentence sprint draws on practice sentences from completed lessons only, in the learner\'s gender', () => {
  const after7 = deviceAfter(7, { gender: 'f' });
  const pool = sentencePool(after7, content, NOW);
  const practice = pool.filter((p) => p.practice);
  assert.ok(practice.length > 0);
  assert.ok(practice.every((p) => Number(p.lessonId.slice(-3)) <= 7));
  assert.ok(pool.some((p) => !p.practice), 'reorder exercises are still in the pool');
  const tired = practice.find((p) => p.id === 'lesson-007:p07');
  assert.equal(tired.exercise.sentence.roman, 'maiN thakii nahiiN huuN.');
  assert.ok(isOrderRight(tired.exercise.answerOrders, ['maiN', 'thakii', 'nahiiN', 'huuN']));
  const man = sentencePool(deviceAfter(7, { gender: 'm' }), content, NOW).find((p) => p.id === 'lesson-007:p07');
  assert.equal(man.exercise.sentence.roman, 'maiN thakaa nahiiN huuN.');
});

test('every listed word order is accepted', () => {
  for (const l of content.lessons) {
    for (const p of l.practice_sentences ?? []) {
      for (const order of practiceOrders(p)) assert.ok(isOrderRight(practiceOrders(p), order), `${l.id}/${p.id}`);
    }
  }
});

test('Listen & type plays short practice sentences in Urdu mode, and only words in meaning mode', () => {
  const data = deviceAfter(10);
  const urdu = poolFor('listen-type', data, content, NOW, { option: 'urdu' });
  const meaning = poolFor('listen-type', data, content, NOW, { option: 'meaning' });
  assert.ok(urdu.some((p) => p.practice));
  assert.ok(urdu.filter((p) => p.practice).every((p) => practiceTiles(p.word.roman).length <= 5));
  assert.ok(!meaning.some((p) => p.practice));
  assert.ok(urdu.length > meaning.length);
});

test('in Listen & type an old practice sentence weighs the same as a word that is not due (credit-eligible words come first)', () => {
  const data = deviceAfter(10, { at: NOW - 30 * DAY });
  const practice = listenPracticePool(data, content, NOW);
  assert.ok(practice.every((p) => Math.abs(p.weight - 0.3) < 1e-9), 'an old practice sentence weighs 0.3');
});

test('the validator checks practice sentences', () => {
  const lesson = (b) => b.lessons[0].data;
  let b = makeBundle();
  lesson(b).practice_sentences = SIX();
  assert.deepEqual(run(b).errors, []);

  b = makeBundle();
  lesson(b).practice_sentences = SIX().slice(0, 5);
  failsWith(b, /practice_sentences/);

  b = makeBundle();
  lesson(b).practice_sentences = SIX();
  lesson(b).practice_sentences[0].roman = 'kyaa Haal';
  failsWith(b, /practice_sentences\[0\]\.roman/);

  b = makeBundle();
  lesson(b).practice_sentences = SIX();
  lesson(b).practice_sentences[0].ur = 'abc';
  failsWith(b, /practice_sentences\[0\]\.ur/);

  b = makeBundle();
  lesson(b).practice_sentences = SIX();
  lesson(b).practice_sentences[0].alt_orders = [['maiN', 'huuN']];
  failsWith(b, /alt_orders\[0\] is not a permutation/);

  b = makeBundle();
  lesson(b).practice_sentences = SIX();
  lesson(b).practice_sentences[1].roman = 'aap Thiik haiN?';
  failsWith(b, /repeats/);

  b = makeBundle();
  lesson(b).practice_sentences = SIX();
  lesson(b).practice_sentences[0].roman = 'maiN Thiik';
  failsWith(b, /has 2 tiles/);
});

test('Unit 1 review has no "next Script lesson" suggestion while the script track does not exist (Phase 7)', () => {
  assert.equal(content.getLesson('lesson-010').review, true);
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []));
  for (const dir of ['src/modules/lesson', 'src/lesson', 'src/modules/today']) {
    for (const file of files(dir)) assert.doesNotMatch(readFileSync(file, 'utf8'), /script lesson/i, file);
  }
});
