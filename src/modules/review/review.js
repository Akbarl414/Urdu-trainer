// Review screen (Anki-style): one card per screen, Again/Hard/Good/Easy with the next interval on
// each button. All the decisions live in src/srs/* and src/lang/normalise.js; this file only draws.
import { h } from '../../ui/dom.js';
import { urduText } from '../../ui/urduText.js';
import { store } from '../../db/storage.js';
import { getContent } from '../../db/contentLoader.js';
import { withSeed } from '../../srs/seed.js';
import { describeCard } from '../../srs/cardFace.js';
import { buildQueue, dueInPriorityOrder, studyDayEnd } from '../../srs/queue.js';
import { createSession, nextCard, releaseWaiting, afterGrade, remaining } from '../../srs/session.js';
import { preview, review, formatInterval, GRADE } from '../../srs/fsrs.js';
import { recordReview, reviewsDoneToday } from '../../srs/stats.js';
import { check, isCorrect } from '../../lang/normalise.js';

// Remembered for this page load only (nothing is written to storage for a UI preference).
let preferredMode = null; // 'speak' | 'type'

const GRADE_BUTTONS = [
  [GRADE.again, 'Again', 'again'],
  [GRADE.hard, 'Hard', 'hard'],
  [GRADE.good, 'Good', 'good'],
  [GRADE.easy, 'Easy', 'easy'],
];

export function render(container) {
  const data = store.data;
  const cards = data.srs.decks.main.cards;
  const source = withSeed(getContent());
  const now0 = Date.now();
  const rolloverHour = data.settings.dayRolloverHour;
  const isReviewable = (id) => describeCard(id, source) !== null;
  const showScript = data.settings.showScript;

  const plan = buildQueue({ cards, now: now0, rolloverHour, cap: data.settings.dailyReviewCap, doneToday: reviewsDoneToday(data, now0), isReviewable });
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
        empty ? h('p', { class: 'muted' }, 'Cards are added automatically as you complete lessons. To try this screen now, add some test cards.') : null,
        left > 0 ? h('p', { class: 'muted' }, `${left} more due today. They stay due; the daily cap (${data.settings.dailyReviewCap}) keeps sessions manageable.`) : null,
        !empty && left === 0 ? h('p', { class: 'muted' }, nextDueText(now)) : null,
        h('div', { class: 'stack' }, empty ? h('a', { class: 'btn', href: '#/debug/seed' }, 'Add test cards') : null, h('a', { class: 'btn btn-secondary', href: '#/' }, 'Back to Today')),
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
    const face = describeCard(id, source);
    const card = cards[id];
    const shownAt = Date.now();
    const modes = face.modes;
    let mode = face.defaultMode;
    if (modes.includes('speak') && modes.includes('type') && preferredMode && modes.includes(preferredMode)) mode = preferredMode;
    let outcome = null; // set once answered: { suggested?: grade, feedback?: Node }

    const body = h('div', { class: 'answer-area' });
    const draw = () => {
      set(promptCard(), body);
      drawAnswerArea();
    };

    function promptCard() {
      const p = face.prompt;
      return h(
        'section',
        { class: 'card prompt' },
        h('div', { class: 'row' }, h('span', { class: 'muted small' }, face.label ?? ''), modes.includes('speak') && modes.includes('type') && !outcome ? modeToggle() : null),
        p.text ? h('p', { class: 'prompt-text' }, p.text) : null,
        p.roman ? h('p', { class: 'prompt-urdu' }, urduText(p, { showScript, big: true })) : null,
        p.tiles ? h('div', { class: 'tiles' }, p.tiles.map((t) => h('span', { class: 'tile' }, t))) : null,
        p.note ? h('p', { class: 'muted small' }, p.note) : null,
        card.weak ? h('p', { class: 'small weak' }, 'Flagged weak in a game') : null,
      );
    }

    function modeToggle() {
      const btn = (m, label) => h('button', { class: `seg${mode === m ? ' on' : ''}`, 'aria-pressed': mode === m ? 'true' : 'false', onclick: () => ((mode = m), (preferredMode = m), draw()) }, label);
      return h('div', { class: 'segmented', role: 'group', 'aria-label': 'Answer mode' }, btn('speak', 'Speak'), btn('type', 'Type'));
    }

    function drawAnswerArea() {
      body.replaceChildren();
      if (outcome) return body.append(...answeredView().filter(Boolean));
      if (mode === 'choice') {
        body.append(
          h(
            'div',
            { class: 'stack' },
            face.options.map((o) =>
              h('button', { class: 'btn btn-secondary choice', onclick: () => chooseOption(o) }, o.label, showScript && o.ur ? h('span', { class: 'urdu-script', lang: 'ur', dir: 'rtl' }, o.ur) : null),
            ),
          ),
        );
      } else if (mode === 'type') {
        const input = h('input', { class: 'field', type: 'text', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', placeholder: 'Type in Roman Urdu', 'aria-label': 'Your answer' });
        const submit = () => typeAnswer(input.value);
        input.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), submit()));
        body.append(input, h('div', { class: 'stack' }, h('button', { class: 'btn', onclick: submit }, 'Check'), h('button', { class: 'btn btn-secondary', onclick: () => reveal(null) }, "I don't know")));
        setTimeout(() => input.focus(), 0);
      } else {
        body.append(
          mode === 'speak' ? h('p', { class: 'muted center' }, 'Say your answer out loud, then check it.') : null,
          h('button', { class: 'btn show', onclick: () => reveal(null) }, 'Show answer'),
        );
      }
    }

    function chooseOption(o) {
      const right = o.value === face.correct;
      reveal({
        suggested: right ? GRADE.good : GRADE.again,
        feedback: h('p', { class: `feedback ${right ? 'good' : 'bad'}` }, right ? 'Correct' : `Not quite — you chose “${o.label}”.`),
      });
    }

    function typeAnswer(text) {
      if (!text.trim()) return;
      const r = check(text, face.answers, { loanwords: face.loanwords });
      const diff = h('span', { class: 'diff' }, r.diff.map((s) => (s.same ? s.text : h('mark', {}, s.text))));
      let feedback;
      if (r.result === 'exact') feedback = h('p', { class: 'feedback good' }, 'Correct');
      else if (r.result === 'close') feedback = h('p', { class: 'feedback good' }, 'Close enough. Exact spelling: ', diff);
      else feedback = h('p', { class: 'feedback bad' }, face.freeOrder ? 'Not a listed answer — other phrasings may be fine, you decide. Model answer: ' : 'Not quite. Expected: ', diff);
      reveal({ suggested: isCorrect(r.result) ? GRADE.good : GRADE.again, feedback });
    }

    function reveal(result) {
      outcome = result ?? {};
      draw();
    }

    function answeredView() {
      const intervals = preview(card, face.facet, Date.now());
      return [
        outcome.feedback,
        h(
          'section',
          { class: 'card reveal' },
          face.reveal.map((row) =>
            h(
              'div',
              { class: 'reveal-row' },
              row.label ? h('span', { class: 'muted small reveal-label' }, row.label) : null,
              row.roman ? urduText(row, { showScript }) : null,
              row.en ? h('span', { class: row.roman ? 'muted' : '' }, row.en) : null,
            ),
          ),
        ),
        h('p', { class: 'muted small center' }, outcome.suggested ? 'How did that feel? (Your call, not the checker’s.)' : 'How well did you remember it?'),
        h(
          'div',
          { class: 'grades' },
          GRADE_BUTTONS.map(([g, label, cls]) =>
            h('button', { class: `grade grade-${cls}${outcome.suggested === g ? ' suggested' : ''}`, onclick: () => grade(g) }, h('span', { class: 'grade-name' }, label), h('span', { class: 'grade-int' }, formatInterval(intervals[g].ms))),
          ),
        ),
      ];
    }

    function grade(g) {
      const now = Date.now();
      const updated = review(card, face.facet, g, now);
      cards[id] = updated;
      recordReview(data, { now, previousState: card.st, seconds: (now - shownAt) / 1000 });
      store.save(); // false = storage full: the banner is already showing and progress stays in memory
      afterGrade(session, id, updated, { now, rolloverHour });
      showNext();
    }

    draw();
  }

  // ---------------------------------------------------------------- start

  showNext();
  return stopTimer;
}
