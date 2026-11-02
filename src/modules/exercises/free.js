// The free-answer widget: Speak or Type (PLAN D19). Used by fill-blank, error-spot, translate and transform
// exercises and by the production check on new words.
//
//   Type   type Roman Urdu; the lenient normaliser (src/lang/normalise.js) judges it. Free-order answers
//          (translate/transform) that don't match are only a suggestion, so the learner decides.
//   Speak  say it out loud, show the answer, mark yourself. Record & compare is offered with the answer.
import { h } from '../../ui/dom.js';
import { urduLine } from '../../ui/urduText.js';
import { store } from '../../db/storage.js';
import { check } from '../../lang/normalise.js';
import { recordCompare } from '../../ui/recordCompare.js';

/**
 * @param {object} o
 * @param {{ add: (fn: () => void) => void }} o.scope
 * @param {string[]} o.modes  e.g. ['type','speak']
 * @param {'type'|'speak'} o.mode  starting mode
 * @param {string[]} o.answers  accepted Roman answers
 * @param {boolean} [o.freeOrder]
 * @param {{ roman: string, ur: string, en?: string }[]} o.model  shown once the learner has tried
 * @param {string} [o.typeStart]  what the text box starts with
 * @param {string} [o.placeholder]
 * @param {Set<string>} [o.loanwords]
 * @param {string} [o.speakPrompt]
 * @param {(correct: boolean) => void} o.onFinish
 */
export function freeAnswer(o) {
  const { modes } = o;
  let mode = o.mode;
  let stage = 'ask'; // ask → review (self-grade) → done
  let feedback = null;
  let typed = o.typeStart ?? '';
  const root = h('div', { class: 'free' });

  const finish = (correct) => {
    if (stage === 'done') return;
    stage = 'done';
    draw();
    o.onFinish(correct);
  };

  function toggle() {
    const btn = (m, label) =>
      h(
        'button',
        { class: `seg${mode === m ? ' on' : ''}`, type: 'button', 'aria-pressed': mode === m ? 'true' : 'false', onclick: () => ((mode = m), store.updateSettings({ answerMode: m }), draw()) },
        label,
      );
    return h('div', { class: 'free-mode' }, h('div', { class: 'segmented', role: 'group', 'aria-label': 'Answer mode' }, btn('speak', 'Speak'), btn('type', 'Type')));
  }

  function modelBlock() {
    return h(
      'div',
      { class: 'card reveal' },
      h('span', { class: 'muted small reveal-label' }, o.model.length > 1 ? 'Ways to say it' : 'Answer'),
      o.model.map((m) => h('div', { class: 'reveal-row' }, urduLine(m), m.en ? h('span', { class: 'muted' }, m.en) : null)),
    );
  }

  function typeUI() {
    const input = h('input', {
      class: 'field',
      type: 'text',
      value: typed,
      autocapitalize: 'off',
      autocomplete: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      enterkeyhint: 'done',
      placeholder: o.placeholder ?? 'Type in Roman Urdu',
      'aria-label': 'Your answer',
    });
    input.addEventListener('input', () => (typed = input.value));
    const submit = () => {
      if (!input.value.trim()) return;
      const r = check(input.value, o.answers, { loanwords: o.loanwords });
      const diff = h('span', { class: 'diff' }, r.diff.map((s) => (s.same ? s.text : h('mark', {}, s.text))));
      if (r.result === 'exact') {
        feedback = h('p', { class: 'feedback good' }, 'Correct');
        finish(true);
      } else if (r.result === 'close') {
        feedback = h('p', { class: 'feedback good' }, 'Close enough. Exact spelling: ', diff);
        finish(true);
      } else if (o.freeOrder) {
        feedback = h('p', { class: 'feedback bad' }, 'Not one of the listed answers. Other phrasings can be fine, so you decide.');
        stage = 'review';
        draw();
      } else {
        feedback = h('p', { class: 'feedback bad' }, 'Not quite. Expected: ', diff);
        finish(false);
      }
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), submit()));
    const giveUp = () => {
      feedback = null;
      finish(false);
    };
    setTimeout(() => stage === 'ask' && mode === 'type' && input.isConnected && input.focus(), 0);
    return [input, h('div', { class: 'stack' }, h('button', { class: 'btn', type: 'button', onclick: submit }, 'Check'), h('button', { class: 'btn btn-secondary', type: 'button', onclick: giveUp }, "I don't know"))];
  }

  function selfGrade(question) {
    return h(
      'div',
      { class: 'self-grade' },
      h('p', { class: 'center' }, question),
      h('div', { class: 'two' }, h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => finish(false) }, 'Not yet'), h('button', { class: 'btn', type: 'button', onclick: () => finish(true) }, 'Got it')),
    );
  }

  function draw() {
    root.replaceChildren();
    if (stage === 'ask') {
      if (modes.length > 1) root.append(toggle());
      if (mode === 'type') root.append(...typeUI());
      else {
        root.append(
          h('p', { class: 'muted center' }, o.speakPrompt ?? 'Say your answer out loud, then check it.'),
          h('button', { class: 'btn show', type: 'button', onclick: () => ((stage = 'review'), (feedback = null), draw()) }, 'Show answer'),
        );
      }
      return;
    }
    if (feedback) root.append(feedback);
    root.append(modelBlock());
    if (stage === 'review') {
      const rc = mode === 'speak' ? recordCompare(o.model[0], o.scope) : null;
      if (rc) root.append(rc);
      root.append(selfGrade(feedback ? 'Did you get it?' : 'How did you do?'));
    }
  }

  draw();
  return root;
}

