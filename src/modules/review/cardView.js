// One review card: prompt, how to answer it, the reveal and the four grade buttons. Shared by the Review
// screen and the lesson's warm-up, so a warm-up review is exactly a real review. All decisions live in
// src/srs/* and src/lang/normalise.js; this file only draws and writes the grade.
import { h } from '../../ui/dom.js';
import { urduLine } from '../../ui/urduText.js';
import { prose } from '../../ui/prose.js';
import { store } from '../../db/storage.js';
import { describeCard, faceOptions, isTilesCorrect } from '../../srs/cardFace.js';
import { tilesView } from '../exercises/tiles.js';
import { audioButton } from '../../ui/audioButton.js';
import { canSpeak } from '../../audio/tts.js';
import { preview, review, formatInterval, GRADE } from '../../srs/fsrs.js';
import { recordReview } from '../../srs/stats.js';
import { check, isCorrect } from '../../lang/normalise.js';

const GRADE_BUTTONS = [
  [GRADE.again, 'Again', 'again'],
  [GRADE.hard, 'Hard', 'hard'],
  [GRADE.good, 'Good', 'good'],
  [GRADE.easy, 'Easy', 'easy'],
];

/**
 * @param {object} o
 * @param {string} o.id  card id
 * @param {any} o.content  content index
 * @param {(...nodes: Node[]) => void} o.show  puts the card's nodes on screen (replacing the previous ones)
 * @param {(id: string, updated: any) => void} o.onGraded  called after the grade is written and saved
 */
export function reviewCard({ id, content, show, onGraded }) {
  const data = store.data;
  const cards = data.srs.decks.main.cards;
  const card = cards[id];
  const face = describeCard(id, content, { ...faceOptions(data, content, { canListen: canSpeak }), card });
  const shownAt = Date.now();
  const modes = face.modes;
  let mode = face.defaultMode;
  const saved = data.settings.answerMode; // the remembered Speak/Type choice, or null
  if (saved && modes.includes(saved) && modes.includes('speak') && modes.includes('type')) mode = saved;
  let outcome = null; // set once answered: { suggested?: grade, feedback?: Node }
  let genderPick = null; // main noun cards: 'm' | 'f' once tapped; the answer and grades wait for it

  const body = h('div', { class: 'answer-area' });
  const draw = () => {
    show(promptCard(), body);
    drawAnswerArea();
  };

  function promptCard() {
    const p = face.prompt;
    return h(
      'section',
      { class: 'card prompt' },
      h('div', { class: 'row' }, h('span', { class: 'muted small' }, face.label ?? ''), modes.includes('speak') && modes.includes('type') && !outcome ? modeToggle() : null),
      p.text ? h('p', { class: 'prompt-text' }, p.text) : null,
      p.roman ? h('p', { class: 'prompt-urdu' }, urduLine(p, { big: true, audio: !p.noAudio })) : null,
      p.listen ? h('div', { class: 'listen-play' }, audioButton(p.listen, { big: true, label: 'Play' })) : null,
      p.note ? h('p', { class: 'muted small' }, p.note) : null,
      card.weak ? h('p', { class: 'small weak' }, 'Flagged weak in a game') : null,
    );
  }

  function modeToggle() {
    const btn = (m, label) => h('button', { class: `seg${mode === m ? ' on' : ''}`, 'aria-pressed': mode === m ? 'true' : 'false', onclick: () => ((mode = m), store.updateSettings({ answerMode: m }), draw()) }, label);
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
          face.options.map((o) => h('button', { class: 'btn btn-secondary choice', onclick: () => chooseOption(o) }, o.label, o.ur ? h('span', { class: 'urdu-script', lang: 'ur', dir: 'rtl' }, o.ur) : null)),
        ),
      );
    } else if (mode === 'tiles') {
      const tv = tilesView(
        face.tiles.tokens,
        (placed) => {
          const right = isTilesCorrect(face, placed);
          tv.lock(right);
          reveal({ suggested: right ? GRADE.good : GRADE.again, feedback: h('p', { class: `feedback ${right ? 'good' : 'bad'}` }, right ? 'Correct' : 'Not quite') });
        },
        { partial: face.tiles.partial },
      );
      body.append(tv.el, h('div', { class: 'stack' }, h('button', { class: 'btn btn-secondary', onclick: () => reveal(null) }, "I don't know")));
    } else if (mode === 'type') {
      const input = h('input', { class: 'field', type: 'text', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', placeholder: 'Type in Roman Urdu', 'aria-label': 'Your answer' });
      const submit = () => typeAnswer(input.value);
      input.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), submit()));
      body.append(input, h('div', { class: 'stack' }, h('button', { class: 'btn', onclick: submit }, 'Check'), h('button', { class: 'btn btn-secondary', onclick: () => reveal(null) }, "I don't know")));
      setTimeout(() => input.focus(), 0);
    } else {
      body.append(...[mode === 'speak' ? h('p', { class: 'muted center' }, 'Say your answer out loud, then check it.') : null, h('button', { class: 'btn show', onclick: () => reveal(null) }, 'Show answer')].filter(Boolean));
    }
  }

  function chooseOption(o) {
    const right = o.value === face.correct || !!face.accepted?.includes(o.value);
    reveal({ suggested: right ? GRADE.good : GRADE.again, feedback: h('p', { class: `feedback ${right ? 'good' : 'bad'}` }, right ? 'Correct' : `Not quite — you chose “${o.label}”.`) });
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

  /** Gender is part of the main card (PLAN D28): the word is answered first, then one tap, then the reveal. */
  function genderQuestion() {
    return [
      outcome.feedback,
      h('p', { class: 'center' }, 'Masculine or feminine?'),
      h('div', { class: 'two' }, h('button', { class: 'btn btn-secondary', onclick: () => ((genderPick = 'm'), draw()) }, 'masculine'), h('button', { class: 'btn btn-secondary', onclick: () => ((genderPick = 'f'), draw()) }, 'feminine')),
    ];
  }

  function answeredView() {
    if (face.gender && !genderPick) return genderQuestion();
    const intervals = preview(card, face.facet, Date.now(), id);
    const genderWrong = !!face.gender && genderPick !== face.gender.correct;
    // A right word with the wrong gender can only suggest Hard; the learner still decides.
    const suggested = genderWrong && (!outcome.suggested || outcome.suggested === GRADE.good) ? GRADE.hard : outcome.suggested;
    const genderRows = face.gender ? [{ label: 'Gender', en: `${face.gender.name}${genderWrong ? ' (you tapped the other one)' : ''}` }, face.gender.plural ? { label: 'Plural', ...face.gender.plural } : null].filter(Boolean) : [];
    return [
      outcome.feedback,
      h(
        'section',
        { class: 'card reveal' },
        [...face.reveal.slice(0, 1), ...genderRows, ...face.reveal.slice(1)].map((row) =>
          h(
            'div',
            { class: 'reveal-row' },
            row.label ? h('span', { class: 'muted small reveal-label' }, row.label) : null,
            row.roman ? urduLine(row) : null,
            row.en ? h('span', { class: row.roman ? 'muted' : '' }, ...prose(row.en)) : null,
          ),
        ),
      ),
      h('p', { class: 'muted small center' }, suggested ? 'How did that feel? (Your call, not the checker’s.)' : 'How well did you remember it?'),
      h(
        'div',
        { class: 'grades' },
        GRADE_BUTTONS.map(([g, label, cls]) =>
          h('button', { class: `grade grade-${cls}${suggested === g ? ' suggested' : ''}`, onclick: () => grade(g) }, h('span', { class: 'grade-name' }, label), h('span', { class: 'grade-int' }, formatInterval(intervals[g].ms))),
        ),
      ),
    ];
  }

  function grade(g) {
    const now = Date.now();
    const graded = review(card, face.facet, g, now, id);
    const updated = face.format ? { ...graded, f: face.format } : graded; // the next review picks a different format
    cards[id] = updated;
    recordReview(data, { now, previousState: card.st, seconds: (now - shownAt) / 1000, correct: g !== GRADE.again });
    store.save(); // false = storage full: the banner is already showing and progress stays in memory
    onGraded(id, updated);
  }

  draw();
}

