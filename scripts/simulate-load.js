// npm run simulate-load: how many reviews a day does the card design cost over 180 days of one lesson a day?
// Uses the real scheduler (src/srs/fsrs.js), queue (src/srs/queue.js) and format rotation (src/srs/format.js).
// Touches no stored data and no content. Seeded, so the numbers repeat.
//
// Options: --cap 35         the daily cap for the second table (default 35)
//          --seeds 5        how many simulated learners to average (default 5)
//          --words 8        new words per lesson (default 8)
//          --retention 0.75 add a scenario with every card at this retention, with games and without

import { createEngine, MEMORY_TARGETS, GRADE, CARD_STATE, markWeak } from '../src/srs/fsrs.js';
import { buildQueue, studyDayEnd } from '../src/srs/queue.js';
import { chooseFormat } from '../src/srs/format.js';
import { earnsGameCredit } from '../src/srs/gameCredit.js';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};
const CAP = arg('cap', 35);
const SEEDS = arg('seeds', 5);
const WORDS_PER_LESSON = arg('words', 8);
const EXTRA_RETENTION = arg('retention', null);

const DAYS = 180;
const DAY_MS = 86400000;
const T0 = new Date(2026, 0, 5, 18).getTime(); // reviews and the lesson happen in the evening

// Course shape (brief §7, CURRICULUM.md).
const SENTENCE_CARDS = [2, 3]; // alternate, so 2.5 a lesson
const PHRASE_SHARE = 0.15;
const IRREGULAR_VERB_SHARE = 0.02; // about 30 irregular verbs over the course
const HAS_EXAMPLE_BLANK = 0.8; // share of words whose example can be blanked for in-sentence recall
const PERFECTIVE_UNLOCK_DAY = 100; // lesson 101

// How a learner answers. P(correct) = the model's own recall probability for the card today, shifted by how forgiving
// the format is. These are assumptions, stated here so they can be argued with.
const FORMAT_SHIFT = { choice: 0.06, meaning_choice: 0.06, situation_choice: 0.06, tiles: 0.03, situation_tiles: 0.03, typed: 0, situation_typed: 0, sentence: 0, meaning_reveal: 0, listen: -0.03 };
const CORRECT_GRADES = [[GRADE.hard, 0.1], [GRADE.good, 0.8], [GRADE.easy, 0.1]]; // what a correct answer gets pressed as
const LEARNING_STEP_P = 0.85; // answering a card again the same day, after missing it
const LESSON_WORD_P = 0.75; // both lesson checks right (a miss is rated Again and comes back the same day)
const LESSON_SENTENCE = { good: 0.8, hard: 0.1 }; // otherwise wrong
const FIRST_PERFECTIVE_P = 0.8;

// Games: 2 rounds a day, about 8 recall-format items a round, played after the day's reviews. Credit follows the guards in gameCredit.js.
const GAME_ROUNDS = 2;
const GAME_ITEMS = 8;
const GAME_FORMAT = 'typed';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickGrade(r) {
  let x = r();
  for (const [g, share] of CORRECT_GRADES) {
    if (x < share) return g;
    x -= share;
  }
  return GRADE.good;
}

async function makeEngine(retention) {
  return createEngine({ fuzz: true, retention });
}

const facetOf = (id) => (id.startsWith('x:') ? 'default' : id.endsWith(':perfective') ? 'perfective' : 'main');
const isLearning = (c) => c.st === CARD_STATE.learning || c.st === CARD_STATE.relearning;

async function simulate({ retention, games, cap, seed, accuracy = 1 }) {
  const engine = await makeEngine(retention);
  const random = rng(seed);
  const cards = {};
  const meta = {}; // id -> { phrase, blank, bornDay }
  const irregular = [];
  const daily = [];
  let screens = 0;
  let attempts = 0;
  let correct = 0;
  let credits = 0;

  const add = (id, card, m) => {
    cards[id] = card;
    meta[id] = m;
  };

  const answer = (id, now, end) => {
    let card = cards[id];
    const facet = facetOf(id);
    const m = meta[id];
    const format = facet === 'main' ? chooseFormat({ card, phrase: m.phrase, available: (f) => f !== 'sentence' || m.blank }) : null;
    const counted = !isLearning(card);
    let p;
    if (card.st === CARD_STATE.new) p = FIRST_PERFECTIVE_P;
    else if (isLearning(card)) p = LEARNING_STEP_P;
    else p = engine.retrievability(card, facet, now) + (FORMAT_SHIFT[format] ?? 0);
    p = Math.min(0.99, Math.max(0.02, p * accuracy));
    const right = random() < p;
    if (counted) {
      attempts++;
      if (right) correct++;
    }
    screens++;
    let next = engine.review(card, facet, right ? pickGrade(random) : GRADE.again, now, id);
    if (format) next = { ...next, f: format };
    cards[id] = next;
    return next.due < end && isLearning(next) ? next.due : null;
  };

  for (let day = 0; day < DAYS; day++) {
    const now = T0 + day * DAY_MS;
    const end = studyDayEnd(now);

    // Reviews, capped the way the app caps them (Learning repeats don't count).
    const plan = buildQueue({ cards, now, cap, doneToday: 0 });
    for (const id of plan.queue) {
      let again = answer(id, now, end);
      for (let i = 0; again !== null && i < 20; i++) again = answer(id, Math.max(now, again), end);
    }

    // Today's lesson.
    const made = [];
    for (let w = 0; w < WORDS_PER_LESSON; w++) {
      const id = `w:d${day}w${w}:main`;
      const m = { phrase: random() < PHRASE_SHARE, blank: random() < HAS_EXAMPLE_BLANK, bornDay: day };
      let card = engine.newCard(now);
      if (random() < LESSON_WORD_P) {
        card = engine.review(card, 'main', GRADE.good, now, id);
        card = engine.review(card, 'main', GRADE.good, now + 60000, id);
      } else card = engine.review(card, 'main', GRADE.again, now, id);
      add(id, card, m);
      made.push(id);
      if (!m.phrase && random() < IRREGULAR_VERB_SHARE) irregular.push(`w:d${day}w${w}:perfective`);
    }
    const sentences = SENTENCE_CARDS[day % SENTENCE_CARDS.length];
    for (let s = 0; s < sentences; s++) {
      const id = `x:lesson-${day}:e0${s}`;
      let card = engine.newCard(now);
      const x = random();
      if (x < LESSON_SENTENCE.good) {
        card = engine.review(card, 'default', GRADE.good, now, id);
        card = engine.review(card, 'default', GRADE.good, now + 60000, id);
      } else if (x < LESSON_SENTENCE.good + LESSON_SENTENCE.hard) card = engine.review(card, 'default', GRADE.hard, now, id);
      else card = engine.review(card, 'default', GRADE.again, now, id);
      add(id, card, { phrase: false, blank: false, bornDay: day });
      made.push(id);
    }
    if (day === PERFECTIVE_UNLOCK_DAY - 1) {
      for (const id of irregular.splice(0)) add(id, engine.newCard(now + DAY_MS), { phrase: false, blank: false, bornDay: day });
    } else if (day >= PERFECTIVE_UNLOCK_DAY) {
      for (const id of irregular.splice(0)) add(id, engine.newCard(now + DAY_MS), { phrase: false, blank: false, bornDay: day });
    }
    // Missed lesson items come back the same day.
    for (const id of made) {
      let again = cards[id].due < end && isLearning(cards[id]) ? cards[id].due : null;
      for (let i = 0; again !== null && i < 20; i++) again = answer(id, Math.max(now, again), end);
    }

    // Games, after the reviews. A correct answer earns a Good review only if the guards allow it; a wrong one marks the card weak.
    if (games) {
      for (let round = 0; round < GAME_ROUNDS; round++) {
        const pool = Object.keys(cards).filter((id) => facetOf(id) === 'main' && cards[id].st === CARD_STATE.review);
        for (let n = 0; n < GAME_ITEMS && pool.length; n++) {
          const weights = pool.map((id) => (1 - engine.retrievability(cards[id], 'main', now)) * 3 + (day - meta[id].bornDay < 7 ? 1.5 : 0) + 0.01);
          let x = random() * weights.reduce((a, b) => a + b, 0);
          let pick = pool.length - 1;
          for (let i = 0; i < pool.length; i++) {
            x -= weights[i];
            if (x <= 0) {
              pick = i;
              break;
            }
          }
          const [id] = pool.splice(pick, 1);
          const before = cards[id];
          if (random() >= Math.min(0.99, engine.retrievability(before, 'main', now) * accuracy)) {
            cards[id] = markWeak(before, now, end);
          } else if (earnsGameCredit({ card: before, format: GAME_FORMAT, now, day })) {
            cards[id] = { ...engine.review(before, 'main', GRADE.good, now, id), f: before.f, gc: day };
            credits++;
          }
        }
      }
    }

    daily.push({ day: day + 1, reviews: plan.queue.length, due: plan.dueTotal, held: plan.held });
  }

  // How much is actually held at the end: mean recall probability across every word's main card.
  const endNow = T0 + DAYS * DAY_MS;
  const mains = Object.keys(cards).filter((id) => facetOf(id) === 'main');
  const recall = mains.reduce((sum, id) => sum + engine.retrievability(cards[id], 'main', endNow), 0) / mains.length;
  return { daily, recall, screens: screens / DAYS, accuracy: attempts ? correct / attempts : 0, cards: Object.keys(cards).length, credits: credits / DAYS };
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Average of the week around a day, so one day's fuzz doesn't decide the number. */
const around = (daily, day) => mean(daily.slice(Math.max(0, day - 4), Math.min(daily.length, day + 3)).map((d) => d.reviews));

async function runScenario(s, cap, accuracy) {
  const runs = [];
  for (let seed = 1; seed <= SEEDS; seed++) runs.push(await simulate({ ...s, cap, seed: seed * 1009, accuracy }));
  return {
    name: s.name,
    avg: mean(runs.map((r) => mean(r.daily.map((d) => d.reviews)))),
    peak: mean(runs.map((r) => Math.max(...r.daily.map((d) => d.reviews)))),
    d30: mean(runs.map((r) => around(r.daily, 30))),
    d90: mean(runs.map((r) => around(r.daily, 90))),
    d180: mean(runs.map((r) => around(r.daily, 180))),
    screens: mean(runs.map((r) => r.screens)),
    accuracy: mean(runs.map((r) => r.accuracy)),
    recall: mean(runs.map((r) => r.recall)),
    credits: mean(runs.map((r) => r.credits)),
    cards: mean(runs.map((r) => r.cards)),
    maxHeld: mean(runs.map((r) => Math.max(...r.daily.map((d) => d.held)))),
    endHeld: mean(runs.map((r) => r.daily[r.daily.length - 1].held)),
    capDays: mean(runs.map((r) => r.daily.filter((d) => d.held > 0).length)),
  };
}

const n0 = (x) => String(Math.round(x));
const pct = (x) => `${Math.round(x * 100)}%`;

function printTable(title, rows, cols) {
  console.log(`\n${title}\n`);
  const header = cols.map((c) => c[0]);
  const cells = rows.map((r) => cols.map((c) => c[1](r)));
  const widths = header.map((h, i) => Math.max(h.length, ...cells.map((row) => row[i].length)));
  const line = (row) => row.map((v, i) => (i === 0 ? v.padEnd(widths[i]) : v.padStart(widths[i]))).join('  ');
  console.log(line(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  cells.forEach((row) => console.log(line(row)));
}

const SCENARIOS = [
  { name: 'Relaxed 0.80 + games (chosen)', retention: MEMORY_TARGETS.relaxed, games: true },
  { name: 'Relaxed 0.80, before games exist', retention: MEMORY_TARGETS.relaxed, games: false },
  { name: 'Balanced 0.85 + games', retention: MEMORY_TARGETS.balanced, games: true },
  { name: 'Strong 0.90 + games', retention: MEMORY_TARGETS.strong, games: true },
];
if (EXTRA_RETENTION) {
  SCENARIOS.push({ name: `all cards at ${EXTRA_RETENTION}`, retention: EXTRA_RETENTION, games: false }, { name: `all cards at ${EXTRA_RETENTION} + games`, retention: EXTRA_RETENTION, games: true });
}

const uncapped = await Promise.all(SCENARIOS.map((s) => runScenario(s, Infinity, 1)));
const capped = await Promise.all(SCENARIOS.map((s) => runScenario(s, CAP, 1)));
const weaker = await Promise.all(SCENARIOS.map((s) => runScenario(s, Infinity, 0.92)));

console.log(`180 days, one lesson a day: ${WORDS_PER_LESSON} new words + 2–3 sentence cards. Average of ${SEEDS} simulated learners.`);
console.log('Reviews = cards that count towards the cap (first answer of each card that day). Days 30/90/180 are 7-day averages.');

const demand = [
  ['Scenario', (r) => r.name],
  ['Avg/day', (r) => n0(r.avg)],
  ['Peak', (r) => n0(r.peak)],
  ['Day 30', (r) => n0(r.d30)],
  ['Day 90', (r) => n0(r.d90)],
  ['Day 180', (r) => n0(r.d180)],
  ['+repeats', (r) => n0(r.screens)],
  ['Game credits', (r) => r.credits.toFixed(1)],
  ['Answered right', (r) => pct(r.accuracy)],
  ['Recall day 180', (r) => pct(r.recall)],
];
printTable('NO CAP: what the schedule asks for', uncapped, demand);
printTable(`CAP ${CAP}: what you would actually do`, capped, [
  ['Scenario', (r) => r.name],
  ['Avg/day', (r) => n0(r.avg)],
  ['Day 30', (r) => n0(r.d30)],
  ['Day 90', (r) => n0(r.d90)],
  ['Day 180', (r) => n0(r.d180)],
  ['Days at cap', (r) => n0(r.capDays)],
  ['Most waiting', (r) => n0(r.maxHeld)],
  ['Waiting day 180', (r) => n0(r.endHeld)],
  ['Recall day 180', (r) => pct(r.recall)],
]);
printTable('NO CAP, a learner who recalls 8% less than the model expects', weaker, demand);
console.log(`\nCards at day 180: about ${n0(uncapped[0].cards)}. "+repeats" counts every card shown per day, including same-day repeats after a miss.`);
