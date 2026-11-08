// The round shell every game shares: intro (rules, personal best, options), the timed round (striped timer bar, score), and the
// results (score, accuracy, personal best with a celebration, the items missed). Games only draw their questions and call
// api.answer(); the shell sends each answer through src/games/outcome.js, the one place game credit is decided.
import { h } from '../../ui/dom.js';
import { urduLine } from '../../ui/urduText.js';
import { store } from '../../db/storage.js';
import { createClock, remaining, fractionLeft, isOver, pause, resume } from '../../games/round.js';
import { applyAnswer, recordRound, bestOf } from '../../games/outcome.js';
import { stopSpeaking } from '../../audio/tts.js';

export const fmtTime = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * @param {HTMLElement} container
 * @param {{ id: string, title: string, rules: string[], durationMs: number, options?: { label: string, choices: { id: string, label: string }[] },
 *   mount: (stage: HTMLElement, api: any, ctx: { option: string|null }) => void }} spec
 * @returns {() => void} cleanup
 */
export function playGame(container, spec) {
  const page = h('main', { class: 'page game' });
  container.append(page);
  let cleanup = () => {};
  let option = spec.options?.choices[0].id ?? null;

  function intro() {
    const best = bestOf(store.data, spec.id);
    page.replaceChildren(
      h('a', { class: 'back', href: '#/games' }, '‹ Games'),
      h('h1', {}, spec.title),
      h('section', { class: 'card' }, h('ul', { class: 'rules' }, spec.rules.map((r) => h('li', {}, r))), h('p', { class: 'muted small' }, `One round is ${Math.round(spec.durationMs / 1000)} seconds.`)),
      spec.options ? optionPicker() : null,
      h('p', { class: 'center muted' }, best?.best != null ? `Your best: ${best.best}. Beat it!` : 'No score yet. Set one to beat.'),
      h('button', { class: 'gbtn gbtn-go', type: 'button', onclick: round }, 'Start'),
    );
  }

  function optionPicker() {
    const box = h('div', { class: 'segmented', role: 'group', 'aria-label': spec.options.label });
    const draw = () =>
      box.replaceChildren(...spec.options.choices.map((c) => h('button', { class: `seg${option === c.id ? ' on' : ''}`, type: 'button', 'aria-pressed': option === c.id ? 'true' : 'false', onclick: () => ((option = c.id), draw()) }, c.label)));
    draw();
    return h('div', { class: 'row' }, h('span', {}, spec.options.label), box);
  }

  function round() {
    cleanup();
    const clock = createClock(spec.durationMs, performance.now());
    const answered = new Set(); // SRS effects apply once per item per round
    const missedKeys = new Set();
    const t = { score: 0, correct: 0, total: 0, credited: 0, missed: [], over: false, saved: false };
    const scoreEl = h('strong', { class: 'score' }, '0');
    const timeEl = h('span', { class: 'time' }, fmtTime(spec.durationMs));
    const fill = h('span', { class: 'bar-fill', style: `width:100%` });
    const bar = h('div', { class: 'bar timer', role: 'progressbar', 'aria-label': 'Time left', 'aria-valuemin': '0', 'aria-valuemax': '100' }, fill);
    const stage = h('div', { class: 'stage' });
    page.replaceChildren(
      h('div', { class: 'game-hud' }, h('a', { class: 'quit', href: '#/games', 'aria-label': 'Quit the round' }, '✕'), h('span', { class: 'hud-score' }, 'Score ', scoreEl), timeEl),
      bar,
      stage,
    );

    const tick = () => {
      const now = performance.now();
      const f = fractionLeft(clock, now);
      fill.style.width = `${(f * 100).toFixed(1)}%`;
      bar.setAttribute('aria-valuenow', String(Math.round(f * 100)));
      bar.classList.toggle('low', remaining(clock, now) <= 10000);
      timeEl.textContent = fmtTime(remaining(clock, now));
      if (isOver(clock, now)) finish();
    };
    const timer = setInterval(tick, 100);
    const onVis = () => (document.hidden ? pause(clock, performance.now()) : resume(clock, performance.now()));
    document.addEventListener('visibilitychange', onVis);

    const api = {
      now: () => performance.now(),
      isOver: () => t.over,
      /** Report one answer. Returns { credited, weak } (what it did to the schedule). */
      answer({ key, cardId = null, correct, format, points = 10, miss = null, uncounted = false, noWeak = false }) {
        if (t.over) return { credited: false, weak: false };
        if (!uncounted) t.total += 1; // uncounted: only marks the item (the second word of a wrong match)
        let out = { credited: false, weak: false };
        if (!answered.has(key)) {
          answered.add(key);
          out = applyAnswer(store.data, { cardId, correct, format, now: Date.now(), noWeak });
          if (out.credited) t.credited += 1;
        }
        if (correct && !uncounted) {
          t.correct += 1;
          t.score += points;
          scoreEl.textContent = String(t.score);
        } else if (!correct && miss && !missedKeys.has(key)) {
          missedKeys.add(key);
          t.missed.push(miss);
        }
        return out;
      },
      addScore(n) {
        t.score += n;
        scoreEl.textContent = String(t.score);
      },
      finish: () => finish(),
    };

    function stop() {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      stopSpeaking();
    }

    function finish() {
      if (t.over) return;
      t.over = true;
      stop();
      const result = recordRound(store.data, { gameId: spec.id, score: t.score, correct: t.correct, total: t.total, now: Date.now() });
      store.save();
      t.saved = true;
      cleanup = () => {};
      results(t, result);
    }

    // Leaving mid-round keeps what the answers did to the schedule (weak marks, credits), but is not a scored round.
    cleanup = () => {
      if (t.over) return;
      t.over = true;
      stop();
      if (t.total > 0) store.save();
    };

    spec.mount(stage, api, { option });
  }

  function results(t, r) {
    const accuracy = t.total ? Math.round((100 * t.correct) / t.total) : 0;
    const record = r.isBest || r.first;
    page.replaceChildren(
      h(
        'section',
        { class: `card results${r.isBest ? ' is-record' : ''}` },
        r.isBest ? celebration() : null,
        h('h1', { class: 'flourish' }, r.isBest ? 'New personal best!' : r.first ? 'First score on the board' : 'Round over'),
        h('p', { class: 'big-score' }, String(t.score)),
        h('p', { class: 'muted center' }, r.isBest ? `Beat your old best of ${r.previousBest}.` : r.first ? 'That is the score to beat.' : `Your best is ${r.best}${t.score === r.best ? '' : `, ${r.best - t.score} more to beat it`}.`),
        h('div', { class: 'stats' }, stat(t.correct, 'right'), stat(t.total, 'answered'), stat(`${accuracy}%`, 'accuracy'), stat(r.best, record ? 'best (now)' : 'best')),
        t.credited > 0 ? h('p', { class: 'muted small center' }, `${t.credited} right answer${t.credited === 1 ? '' : 's'} counted as ${t.credited === 1 ? 'a review' : 'reviews'}, so ${t.credited === 1 ? 'it comes' : 'they come'} back later.`) : null,
      ),
      t.missed.length
        ? h(
            'section',
            { class: 'card missed' },
            h('h2', {}, `Missed (${t.missed.length})`),
            h('p', { class: 'muted small' }, 'These are marked weak, so they come back sooner in reviews and games.'),
            h('ul', { class: 'missed-list' }, t.missed.map((m) => h('li', {}, m.roman ? urduLine(m) : null, h('span', { class: 'muted' }, m.en ?? ''), m.note ? h('span', { class: 'muted small' }, m.note) : null))),
          )
        : h('p', { class: 'center' }, 'Nothing missed. Lovely.'),
      h('div', { class: 'stack' }, h('button', { class: 'gbtn gbtn-go', type: 'button', onclick: round }, 'Play again'), h('a', { class: 'btn btn-secondary', href: '#/games' }, 'Back to Games')),
    );
  }

  const stat = (v, label) => h('div', { class: 'stat' }, h('strong', {}, String(v)), h('span', { class: 'muted small' }, label));
  const celebration = () => h('div', { class: 'burst', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => h('i', { style: `--a:${(i * 360) / 14}deg;--d:${0.55 + (i % 4) * 0.12}s;--c:${(i % 3) + 1}` }, '◆')));

  intro();
  return () => cleanup();
}

/** A press-down answer button. */
export const gbtn = (label, onclick, cls = '') => h('button', { class: `gbtn ${cls}`.trim(), type: 'button', onclick }, label);

/** Paint a button right or wrong (marigold / hot pink in Truck Art; the theme's good / bad elsewhere), with a mark so colour is never the only cue. */
export function mark(btn, right) {
  btn.classList.add(right ? 'is-right' : 'is-wrong');
}

/** What shows under the answer box after a word question: ✓ / ✗, the Urdu with its meaning, and the plural for nouns. */
export function feedbackNodes(right, reveal) {
  return [h('p', { class: `feedback ${right ? 'good' : 'bad'}` }, right ? '✓ Right' : '✗ Not quite'), urduLine(reveal), h('p', { class: 'muted' }, reveal.en), reveal.note ? h('p', { class: 'muted small' }, reveal.note) : null].filter(Boolean);
}
