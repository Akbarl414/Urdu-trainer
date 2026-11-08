// The Stats page: reviews per day, words learned, accuracy, units, streak and personal bests. Simple SVG charts in the theme's colours.
import { h } from '../../ui/dom.js';
import { store } from '../../db/storage.js';
import { getContent } from '../../db/contentLoader.js';
import { studyDay } from '../../db/day.js';
import { currentStreak } from '../../lesson/path.js';
import { barChart, lineChart } from '../../ui/charts.js';
import { reviewsPerDay, accuracyTrend, wordsOverTime, unitProgress, targetRetention, sumDays } from '../../games/history.js';
import { GAMES } from '../../games/catalog.js';
import { bestOf } from '../../games/outcome.js';

const TARGET_NAME = { relaxed: 'Relaxed', balanced: 'Balanced', strong: 'Strong' };

const chartCard = (title, svg, summary, extra) => h('section', { class: 'card chart-card' }, h('h2', {}, title), svg, h('p', { class: 'muted small' }, summary), extra);

export function render(container) {
  const { data } = store;
  const content = getContent();
  const day = studyDay(Date.now(), data.settings.dayRolloverHour);
  const cap = data.settings.dailyReviewCap;
  const target = targetRetention(data.settings);
  const streak = currentStreak(data.stats, day);

  const reviews = reviewsPerDay(data, day, 14);
  const total14 = reviews.reduce((a, p) => a + p.value, 0);
  const busiest = Math.max(...reviews.map((p) => p.value));
  const words = wordsOverTime(data, content, day, 30);
  const acc = accuracyTrend(data, day, 30, 7);
  const lastAcc = [...acc].reverse().find((p) => p.value != null);
  const units = unitProgress(data, content);
  const wordsNow = words.at(-1).value;

  container.append(
    h(
      'main',
      { class: 'page stats-page' },
      h('a', { class: 'back', href: '#/games' }, '‹ Games'),
      h('h1', {}, 'Your progress'),
      h('section', { class: 'card' }, h('div', { class: 'stats' }, stat(streak, streak === 1 ? 'day streak' : 'day streak'), stat(data.stats.bestStreak, 'best streak'), stat(wordsNow, 'words learned'), stat(sumDays(data, day, 7, 'reviews'), 'reviews, 7 days'))),
      chartCard('Reviews per day', barChart({ points: reviews, refs: [{ value: cap, label: `cap ${cap}` }], over: cap, label: `Reviews per day, last 14 days. Daily cap ${cap}.` }), `Last 14 days: ${total14} reviews, busiest day ${busiest}. The dashed line is your daily cap (${cap}); a bar above it is a day you went over. Memory target: ${TARGET_NAME[data.settings.memoryTarget] ?? 'Relaxed'}, about ${Math.round(target * 100)}% remembered when cards come back.`),
      chartCard('Words learned', lineChart({ points: words, label: 'Words learned over the last 30 days', floor: 0 }), wordsNow ? `${wordsNow} words and phrases so far.` : 'Finish a lesson and your words appear here.'),
      chartCard('Accuracy', lineChart({ points: acc, percent: true, refs: [{ value: target, label: `target ${Math.round(target * 100)}%` }], label: 'Review accuracy, 7-day average, last 30 days' }), lastAcc ? `Over the last week you answered ${Math.round(lastAcc.value * 100)}% of reviews right. Your memory target is ${Math.round(target * 100)}%: landing near it means the schedule is working.` : 'Needs a few days of reviews. Days before this feature are not counted.'),
      h('section', { class: 'card' }, h('h2', {}, 'Units'), units.length ? units.map(unitRow) : h('p', { class: 'muted' }, 'No units yet.')),
      h('section', { class: 'card' }, h('h2', {}, 'Personal bests'), h('ul', { class: 'bests' }, GAMES.map((g) => { const b = bestOf(data, g.id); return h('li', {}, h('span', {}, g.title), h('strong', {}, b?.best != null ? String(b.best) : '–'), b?.bestAccuracy != null ? h('span', { class: 'muted small' }, `${Math.round(b.bestAccuracy * 100)}% accurate`) : h('span', { class: 'muted small' }, 'not played')); }))),
    ),
  );
}

const stat = (v, label) => h('div', { class: 'stat' }, h('strong', {}, String(v)), h('span', { class: 'muted small' }, label));

function unitRow(u) {
  const pct = u.lessonsTotal ? Math.round((100 * u.lessonsDone) / u.lessonsTotal) : 0;
  return h(
    'div',
    { class: 'unit-row' },
    h('div', { class: 'row' }, h('strong', {}, `Unit ${u.unit.order}: ${u.unit.title}`), h('span', { class: 'muted small' }, `${u.lessonsDone}/${u.lessonsTotal} lessons`)),
    h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': `Unit ${u.unit.order} lessons done` }, h('span', { class: 'bar-fill', style: `width:${pct}%` })),
    h('p', { class: 'muted small' }, `${u.wordsLearned} of ${u.wordsTotal} words learned${u.wordsLearned ? `, ${u.wordsStrong} well remembered` : ''}.`),
  );
}
