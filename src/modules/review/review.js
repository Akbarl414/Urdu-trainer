// Review screen (Anki-style): one card per screen, Again/Hard/Good/Easy with the next interval on
// each button. All the decisions live in src/srs/* and src/lang/normalise.js; this file only draws.
import { h } from '../../ui/dom.js';
import { reviewCard } from './cardView.js';
import { store } from '../../db/storage.js';
import { getContent } from '../../db/contentLoader.js';
import { isReviewable as canShow, lessonOfCard } from '../../srs/cardFace.js';
import { buildQueue, dueInPriorityOrder, studyDayEnd } from '../../srs/queue.js';
import { createSession, nextCard, releaseWaiting, afterGrade, remaining } from '../../srs/session.js';
import { formatInterval } from '../../srs/fsrs.js';
import { reviewsDoneToday } from '../../srs/stats.js';

export function render(container) {
  const data = store.data;
  const cards = data.srs.decks.main.cards;
  const source = getContent();
  const now0 = Date.now();
  const rolloverHour = data.settings.dayRolloverHour;
  const isReviewable = (id) => canShow(id, source);

  const plan = buildQueue({ cards, now: now0, rolloverHour, cap: data.settings.dailyReviewCap, doneToday: reviewsDoneToday(data, now0), isReviewable, lessonOf: (id) => lessonOfCard(id, source) });
  const session = createSession(plan.queue);
  let timer = null;
  const stopTimer = () => {
    clearInterval(timer);
    timer = null;
  };

  const page = h('main', { class: 'page review' });
  container.append(page);
  const set = (...children) => page.replaceChildren(topBar(), ...children);

  function topBar() {
    const left = remaining(session);
    return h(
      'div',
      { class: 'review-top' },
      h('div', { class: 'row' }, h('a', { class: 'back', href: '#/' }, '‹ Today'), h('span', { class: 'muted small' }, left ? `${left} left` : '')),
      plan.dueTotal > 0 ? h('p', { class: 'muted small summary' }, summaryLine()) : null,
    );
  }

  function summaryLine() {
    const bits = [`${plan.dueTotal} due`];
    if (plan.held > 0) bits.push(`${plan.held} kept for later (daily cap ${data.settings.dailyReviewCap})`);
    if (plan.dueTotal > data.settings.dailyReviewCap) bits.push(`about ${plan.catchUpDays} days to catch up`);
    return bits.join(' · ');
  }

  function showNext() {
    stopTimer();
    const next = nextCard(session, Date.now());
    if (next === null) return renderDone();
    if ('wait' in next) return renderWait(next.wait);
    return renderCard(next.id);
  }

  // ---------------------------------------------------------------- finished / waiting

  function renderDone() {
    const now = Date.now();
    const left = dueInPriorityOrder(cards, now, { rolloverHour, isReviewable }).length;
    const empty = Object.keys(cards).length === 0;
    set(
      h(
        'section',
        { class: 'card center' },
        h('h1', {}, session.reviewed > 0 ? 'All done' : empty ? 'No cards yet' : 'Nothing due'),
        session.reviewed > 0 ? h('p', {}, `${session.reviewed} card${session.reviewed === 1 ? '' : 's'} reviewed.`) : null,
        empty ? h('p', { class: 'muted' }, 'Cards are added automatically as you complete lessons.') : null,
        left > 0 ? h('p', { class: 'muted' }, `${left} more due today. They stay due; the daily cap (${data.settings.dailyReviewCap}) keeps sessions manageable.`) : null,
        !empty && left === 0 ? h('p', { class: 'muted' }, nextDueText(now)) : null,
        h('div', { class: 'stack' }, h('a', { class: 'btn btn-secondary', href: '#/' }, 'Back to Today')),
      ),
    );
  }

  function nextDueText(now) {
    const dues = Object.entries(cards).filter(([id]) => isReviewable(id)).map(([, c]) => c.due);
    if (!dues.length) return '';
    const soonest = Math.min(...dues);
    const end = studyDayEnd(now, rolloverHour);
    return soonest < end ? 'Everything due today is done.' : `Next review in ${formatInterval(soonest - now)}.`;
  }

  function renderWait(dueAt) {
    const seconds = h('strong', {}, '');
    const tick = () => {
      const s = Math.max(0, Math.ceil((dueAt - Date.now()) / 1000));
      seconds.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (s === 0) showNext();
    };
    set(
      h(
        'section',
        { class: 'card center' },
        h('h1', {}, 'Short break'),
        h('p', {}, 'Next card in ', seconds),
        h('p', { class: 'muted small' }, "Cards you got wrong come back after a few minutes, so there's something to remember."),
        h('div', { class: 'stack' }, h('button', { class: 'btn', onclick: () => (releaseWaiting(session), showNext()) }, 'Study now'), h('button', { class: 'btn btn-secondary', onclick: renderDone }, 'Finish for now')),
      ),
    );
    tick();
    timer = setInterval(tick, 1000);
  }

  // ---------------------------------------------------------------- one card

  function renderCard(id) {
    reviewCard({
      id,
      content: source,
      show: set,
      onGraded: (cardId, updated) => {
        afterGrade(session, cardId, updated, { now: Date.now(), rolloverHour });
        showNext();
      },
    });
  }

  // ---------------------------------------------------------------- start

  showNext();
  return stopTimer;
}
