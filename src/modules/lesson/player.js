// The lesson player (BRIEF §5.2, PLAN §6.2): warm-up → grammar → new words → practice → dialogue → summary.
// Built generically from the lesson JSON. The state machine (src/lesson/machine.js) decides what comes next;
// this file draws one screen at a time and saves the run after every transition, so closing the app
// mid-lesson and coming back continues exactly there.
import { h } from '../../ui/dom.js';
import { prose } from '../../ui/prose.js';
import { scriptToggle } from '../../ui/scriptToggle.js';
import { createScope } from '../../ui/scope.js';
import { store } from '../../db/storage.js';
import { getContent } from '../../db/contentLoader.js';
import { studyDay } from '../../db/day.js';
import { planLesson } from '../../lesson/planner.js';
import { startRun, advance, skipStep, resumeOn, runProblem, progressLine, overallProgress, addActiveSeconds } from '../../lesson/machine.js';
import { commitLesson } from '../../lesson/commit.js';
import { nextLesson, todayQueue } from '../../lesson/path.js';
import { loanwordTokens } from '../../lesson/loanwords.js';
import { whenAudioReady, canSpeak, stopSpeaking } from '../../audio/tts.js';
import { mountWarmup } from './screens/warmup.js';
import { mountGrammar } from './screens/grammar.js';
import { mountWords } from './screens/words.js';
import { mountPractice } from './screens/practice.js';
import { mountDialogue } from './screens/dialogue.js';
import { mountSummary, doneView } from './screens/summary.js';

const SCREEN_SEC_CAP = 120; // a forgotten phone shouldn't count as study time

export const render = (container) => mount(container, false);
/** "Do one more lesson" today. */
export const renderExtra = (container) => mount(container, true);

function mount(container, extra) {
  const content = getContent();
  const data = store.data;
  const loanwords = loanwordTokens(content);

  let alive = true;
  let run = null;
  let lesson = null;
  let scope = createScope();
  let shownAt = Date.now();

  const label = h('span', { class: 'lesson-step' }, '');
  const bar = h('span', { class: 'bar-fill' });
  const top = h('header', { class: 'lesson-top' }, h('div', { class: 'row lesson-nav' }, h('a', { class: 'back', href: '#/' }, '‹ Today'), label, scriptToggle()), h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, bar));
  const body = h('div', { class: 'lesson-body' });
  const actions = h('div', { class: 'lesson-actions' });
  const page = h('main', { class: 'page lesson' }, top, body, actions);
  container.append(page);

  const setActions = (...nodes) => actions.replaceChildren(...nodes.filter(Boolean));

  function persist() {
    data.progress.run = run;
    store.save(); // false = storage full; the banner is already showing and the run stays in memory
  }

  function clearScreen() {
    scope.run();
    scope = createScope();
    stopSpeaking();
    body.replaceChildren();
    actions.replaceChildren();
  }

  function message(title, text, ...buttons) {
    clearScreen();
    top.hidden = true;
    body.append(h('section', { class: 'card center' }, h('h2', {}, title), h('p', {}, ...prose(text))));
    setActions(...buttons);
  }

  const ctxFor = () => ({
    content,
    data,
    lesson,
    run,
    scope,
    body,
    loanwords,
    learnerGender: data.settings.learnerGender,
    setActions,
    /** Finish the current screen: apply `fn(run, secondsOnScreen)`, move on, save, draw. */
    complete(fn) {
      const sec = Math.min(SCREEN_SEC_CAP, (Date.now() - shownAt) / 1000);
      run = advance(addActiveSeconds(fn(run, sec), sec), lesson);
      persist();
      renderScreen();
    },
    skipStep() {
      run = skipStep(run, lesson);
      persist();
      renderScreen();
    },
    finish() {
      try {
        const result = commitLesson(data, content, Date.now());
        run = null;
        store.save();
        clearScreen();
        top.hidden = true;
        doneView({ ...ctxFor(), run: null }, result);
      } catch (e) {
        console.error(e);
        message('Could not finish the lesson', 'Nothing was lost: your progress in this lesson is still saved. Please try again.', h('button', { class: 'btn', type: 'button', onclick: renderScreen }, 'Try again'), h('a', { class: 'btn btn-secondary', href: '#/' }, 'Back to Today'));
      }
    },
    another() {
      begin(true);
    },
  });

  function updateTop() {
    const p = progressLine(run, lesson);
    label.textContent = run.step === 'summary' ? 'Summary' : `${p.label} · ${p.current}/${p.of}`;
    const pct = Math.round(overallProgress(run, lesson) * 100);
    bar.style.width = `${pct}%`;
    top.querySelector('.bar').setAttribute('aria-valuenow', String(pct));
  }

  function renderScreen() {
    if (!alive) return;
    try {
      clearScreen();
      top.hidden = false;
      updateTop();
      shownAt = Date.now();
      const ctx = ctxFor();
      switch (run.step) {
        case 'warmup':
          mountWarmup(ctx);
          break;
        case 'grammar':
          mountGrammar(ctx);
          break;
        case 'words':
          mountWords(ctx);
          break;
        case 'practice':
          mountPractice(ctx);
          break;
        case 'dialogue':
          mountDialogue(ctx);
          break;
        default:
          mountSummary(ctx);
      }
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      message('Something went wrong on this screen', 'Your progress is saved. Go back to Today and continue from there.', h('a', { class: 'btn', href: '#/' }, 'Back to Today'));
    }
  }

  function problemScreen(problem) {
    message(
      'This lesson can’t be continued',
      problem,
      h('a', { class: 'btn', href: '#/' }, 'Back to Today'),
      h(
        'button',
        {
          class: 'btn btn-secondary',
          type: 'button',
          onclick: () => {
            // An explicit, confirmed choice: only this unfinished lesson run is dropped. Cards and completed lessons are untouched.
            if (!window.confirm('Drop the unfinished lesson and start it again? Your reviews and completed lessons are not affected.')) return;
            data.progress.run = null;
            store.save();
            window.location.hash = '#/';
          },
        },
        'Start this lesson again',
      ),
    );
  }

  async function begin(allowExtra) {
    const now = Date.now();
    const day = studyDay(now, data.settings.dayRolloverHour);
    const canListen = () => canSpeak({ roman: 'x', ur: 'x' }); // any voice at all; files are per item and checked on screen
    const planFor = (l, q) =>
      planLesson({ lesson: l, dueQueue: q.queue, dueTotal: q.dueTotal, capRemaining: q.capRemaining, dailyReviewCap: data.settings.dailyReviewCap, pace: data.stats.pace, canListen: canListen() });

    const stored = data.progress.run;
    if (stored) {
      const problem = runProblem(stored, content);
      if (problem) return problemScreen(problem);
      lesson = content.getLesson(stored.lessonId);
      run = stored;
      if (run.studyDay !== day) {
        await whenAudioReady();
        if (!alive) return;
        run = resumeOn(run, lesson, { studyDay: day, warmup: planFor(lesson, todayQueue(data, content, now)).warmup });
        persist();
      }
      return renderScreen();
    }

    const next = nextLesson(data, content);
    const doneToday = (data.stats.days[day]?.lessons ?? 0) > 0;
    if (!next || (doneToday && !allowExtra)) {
      window.location.hash = '#/';
      return;
    }
    body.replaceChildren(h('p', { class: 'muted center' }, 'Getting your lesson ready…'));
    await whenAudioReady();
    if (!alive) return;
    lesson = next;
    run = startRun({ lesson, plan: planFor(lesson, todayQueue(data, content, now)), studyDay: day, now });
    persist();
    renderScreen();
  }

  begin(extra);
  return () => {
    alive = false;
    scope.run();
    stopSpeaking();
  };
}
