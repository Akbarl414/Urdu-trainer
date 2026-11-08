// The Today screen (BRIEF §5.1): one big button, an honest progress line, and — until it has been
// answered — the first-run question about the learner's gender (PLAN D23).
import { h } from '../../ui/dom.js';
import { prose } from '../../ui/prose.js';
import { scriptToggle } from '../../ui/scriptToggle.js';
import { store } from '../../db/storage.js';
import { getContent } from '../../db/contentLoader.js';
import { todayState, todayQueue } from '../../lesson/path.js';
import { practisableLessons } from '../../lesson/practice.js';
import { planLesson } from '../../lesson/planner.js';
import { onAudioChange } from '../../audio/tts.js';
import { gameOfDay } from '../games/gotd.js';
import { gotdCard } from '../games/gotdCard.js';
import { bestOf } from '../../games/outcome.js';

let askLater = false; // "Not now" lasts until the app is reopened (memory only; nothing is stored)

function genderCard({ onAnswer, onLater, current }) {
  return h(
    'section',
    { class: 'card ask' },
    h('h2', {}, 'One quick question'),
    h('p', {}, 'Urdu changes some words depending on who is speaking. “I’m tired” is ', h('span', { class: 'rom' }, 'maiN thakaa huuN'), ' if you’re a man and ', h('span', { class: 'rom' }, 'maiN thakii huuN'), ' if you’re a woman.'),
    h('p', {}, 'So your own lines in lessons, exercises and reviews use the forms you would actually say. Which should I use?'),
    h('div', { class: 'two' }, h('button', { class: `btn${current === 'm' ? '' : ''}`, type: 'button', onclick: () => onAnswer('m') }, 'I’m a man'), h('button', { class: 'btn', type: 'button', onclick: () => onAnswer('f') }, 'I’m a woman')),
    h('p', { class: 'muted small' }, 'This only picks which forms of your own sentences you practise. You can change it later.'),
    onLater ? h('button', { class: 'linklike', type: 'button', onclick: onLater }, 'Not now') : null,
  );
}

export function render(container) {
  const content = getContent();
  const data = store.data;
  const page = h('main', { class: 'page today' });
  container.append(page);

  function draw() {
    const now = Date.now();
    const queue = todayQueue(data, content, now);
    const t = todayState({ data, content, now, queue });
    const cap = data.settings.dailyReviewCap;

    const gender = t.needsGender && !askLater ? genderCard({ onAnswer: answer, onLater: () => ((askLater = true), draw()) }) : null;

    const bits = [];
    if (t.position) bits.push(`Lesson ${t.position.lessonNumber} · Unit ${t.position.unitNumber}`);
    else bits.push(`${t.lessonsDone} lesson${t.lessonsDone === 1 ? '' : 's'} done`);
    bits.push(t.dueTotal > 0 ? `${t.dueTotal} due` : 'nothing due');
    if (t.streak > 0) bits.push(`🔥 ${t.streak} day${t.streak === 1 ? '' : 's'}`);

    page.replaceChildren(
      ...[
      h('h1', {}, 'Urdu Trainer'),
      h('p', { class: 'progress-line' }, bits.join(' · ')),
      gender,
      primaryCard(t, queue, now, cap),
      gotdSection(),
      reviewCard(t, queue, cap),
      practiceCard(),
      h(
        'section',
        { class: 'card tools' },
        h('div', { class: 'row' }, h('span', {}, 'Show Urdu script'), scriptToggle()),
      ),
      h('p', { class: 'muted small build' }, `Build ${__BUILD_ID__} · ${content.lessons.length} lesson${content.lessons.length === 1 ? '' : 's'} available`),
      ].filter(Boolean),
    );
  }

  function answer(g) {
    store.updateSettings({ learnerGender: g });
    draw();
  }

  function primaryCard(t, queue, now, cap) {
    const lessonLine = (l) => [h('p', { class: 'lesson-title' }, `Lesson ${l.order}: ${l.title}`), h('p', { class: 'muted' }, ...prose(l.can_do))];
    switch (t.primary) {
      case 'resume':
        return h(
          'section',
          { class: 'card primary' },
          h('p', { class: 'muted small' }, 'In progress'),
          ...lessonLine(t.runLesson),
          h('p', { class: 'muted small' }, `${t.runProgress.label} · ${t.runProgress.current} of ${t.runProgress.of}`),
          h('a', { class: 'btn btn-big', href: '#/lesson' }, 'Continue today’s lesson'),
        );
      case 'problem':
        return h('section', { class: 'card warn' }, h('h2', {}, 'A lesson is waiting'), h('p', {}, t.runProblem), h('a', { class: 'btn', href: '#/lesson' }, 'Open it'));
      case 'review':
        return h(
          'section',
          { class: 'card primary' },
          h('p', { class: 'lesson-title' }, 'Catch-up day'),
          h('p', { class: 'muted' }, `${t.dueTotal} reviews are due, about ${t.catchUpDays} days at ${cap} a day. A review session first keeps things manageable.`),
          h('a', { class: 'btn btn-big', href: '#/review' }, '15-minute review session'),
          h('a', { class: 'btn btn-secondary', href: '#/lesson' }, `Do lesson ${t.lesson.order} anyway`),
        );
      case 'done-today':
        return h(
          'section',
          { class: 'card primary done' },
          h('p', { class: 'lesson-title' }, '✓ Today’s lesson is done'),
          h('p', { class: 'muted' }, `Lesson ${t.lesson.order}: ${t.lesson.title} is scheduled for tomorrow.`),
          h('a', { class: 'btn btn-secondary', href: '#/lesson/extra' }, 'Do one more lesson'),
          h('p', { class: 'muted small' }, 'Each lesson adds about 20 reviews over the next week, so they will pile up faster.'),
        );
      case 'all-done':
        return h('section', { class: 'card primary' }, h('p', { class: 'lesson-title' }, 'You’ve finished every lesson so far'), h('p', { class: 'muted' }, 'New lessons arrive as content is added. Reviews keep what you’ve learned fresh.'));
      default: {
        const plan = planLesson({ lesson: t.lesson, dueQueue: queue.queue, dueTotal: queue.dueTotal, capRemaining: queue.capRemaining, dailyReviewCap: cap, pace: data.stats.pace });
        return h(
          'section',
          { class: 'card primary' },
          ...lessonLine(t.lesson),
          h('p', { class: 'muted small' }, `About ${Math.max(5, Math.round(plan.estimateSec / 60))} minutes`),
          plan.mode !== 'normal' ? h('p', { class: 'small' }, `${queue.dueTotal} reviews are due, so this lesson is shorter. Do them in Review afterwards.`) : null,
          h('a', { class: 'btn btn-big', href: '#/lesson' }, 'Start today’s lesson'),
        );
      }
    }
  }

  /** Today's game of the day, once any game is unlocked (PLAN D37). */
  function gotdSection() {
    const g = gameOfDay();
    return g ? gotdCard(g, { best: bestOf(data, g.game.id) }) : null;
  }

  /** Replay a finished lesson as practice only (no cards, no scheduling, no progress). Until the Library exists (Phase 5). */
  function practiceCard() {
    const done = practisableLessons(data, content);
    if (done.length === 0) return null;
    return h(
      'details',
      { class: 'card practice' },
      h('summary', {}, h('strong', {}, 'Practise a finished lesson')),
      h('p', { class: 'muted small' }, 'Go through a lesson again for practice. Nothing is saved: your reviews, schedule and progress stay exactly as they are.'),
      h('ul', { class: 'practice-list' }, done.map((l) => h('li', {}, h('a', { href: `#/practice/${l.id}` }, `Lesson ${l.order}: ${l.title}`)))),
    );
  }

  function reviewCard(t, queue, cap) {
    if (t.dueTotal === 0) return null;
    const lines = [`${t.dueTotal} due${queue.held > 0 ? ` · ${queue.queue.length} in today’s session (daily cap ${cap})` : ''}.`];
    if (t.dueTotal > cap) lines.push(`About ${t.catchUpDays} days to catch up at ${cap} a day.`);
    return h('section', { class: 'card' }, h('h2', {}, 'Review'), h('p', {}, lines.join(' ')), h('a', { class: `btn${t.primary === 'review' ? ' btn-secondary' : ' btn-secondary'}`, href: '#/review' }, 'Start review'));
  }

  draw();
  return onAudioChange(draw); // voices load late, and Listen & type needs one to count as unlocked
}
