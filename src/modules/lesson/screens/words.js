// Step 3: new words. Each word is shown in a context sentence with audio; "I already know this" skips its
// checks, "New to me" runs a quick recognition check and then a production check (PLAN §6.2).
import { h } from '../../../ui/dom.js';
import { urduLine } from '../../../ui/urduText.js';
import { para, prose } from '../../../ui/prose.js';
import { store } from '../../../db/storage.js';
import { markKnown, recordWord } from '../../../lesson/machine.js';
import { recognitionOptions, productionPrompt, productionAnswers } from '../../../lesson/wordChecks.js';
import { startMode } from '../../../lesson/exercises.js';
import { choiceList } from '../../exercises/choice.js';
import { freeAnswer } from '../../exercises/free.js';

const POS = { noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', postposition: 'postposition', pronoun: 'pronoun', phrase: 'phrase', other: '' };
const GENDER = { m: 'masculine', f: 'feminine', mf: 'masculine or feminine' };

const addSec = (run, wordId, sec) => recordWord(run, wordId, { sec: (run.wordResults[wordId]?.sec ?? 0) + sec });

export function mountWords(ctx) {
  const wordId = ctx.lesson.new_vocab[ctx.run.index];
  const word = ctx.content.getWord(wordId);
  if (!word) return ctx.complete((run) => run);
  const sub = ctx.run.sub ?? 'intro';
  const header = (text) => h('p', { class: 'muted small center' }, text);

  if (sub === 'intro') {
    const tag = [POS[word.pos], GENDER[word.gender]].filter(Boolean).join(' · ');
    ctx.body.append(
      header(`New word ${ctx.run.index + 1} of ${ctx.lesson.new_vocab.length}`),
      h(
        'section',
        { class: 'card word-intro' },
        tag ? h('p', { class: 'chip' }, tag) : null,
        h('div', { class: 'word-head' }, urduLine(word, { big: true })),
        h('p', { class: 'word-meaning' }, word.meaning_en),
        word.literal ? h('p', { class: 'muted small' }, 'Word for word: ', word.literal) : null,
        word.example ? h('div', { class: 'example' }, h('span', { class: 'muted small reveal-label' }, 'In a sentence'), urduLine(word.example), h('span', { class: 'muted ex-en' }, word.example.en)) : null,
        word.notes ? para(word.notes, 'muted small note') : null,
        word.hindi_variant ? h('p', { class: 'muted small' }, h('strong', {}, 'Hindi: '), h('span', { class: 'rom' }, word.hindi_variant.roman), word.hindi_variant.note ? ' — ' : '', ...prose(word.hindi_variant.note ?? '')) : null,
      ),
    );
    ctx.setActions(
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => ctx.complete((run, sec) => markKnown(addSec(run, wordId, sec), wordId)) }, 'I already know this'),
      h('button', { class: 'btn', type: 'button', onclick: () => ctx.complete((run, sec) => addSec(run, wordId, sec)) }, 'New to me'),
    );
    return;
  }

  if (sub === 'recog') {
    const pool = [...ctx.content.newWordsOf(ctx.lesson.id), ...ctx.content.words.filter((w) => !w.retired)];
    const { options, answerIndex } = recognitionOptions(word, pool);
    let result = null;
    const list = choiceList(options.map((text) => ({ text })), (i) => {
      result = i === answerIndex;
      list.reveal(answerIndex, i);
      after.replaceChildren(
        h('p', { class: `feedback ${result ? 'good' : 'bad'}` }, result ? 'Correct' : 'Not quite'),
        h('div', { class: 'card reveal' }, h('div', { class: 'reveal-row' }, urduLine(word), h('span', { class: 'muted' }, word.meaning_en))),
      );
      ctx.setActions(h('button', { class: 'btn', type: 'button', onclick: () => ctx.complete((run, sec) => addSec(recordWord(run, wordId, { recog: result }), wordId, sec)) }, 'Continue'));
    });
    const after = h('div', { class: 'ex-after' });
    ctx.body.append(
      header('Quick check'),
      h('section', { class: 'card exercise' }, h('p', { class: 'ex-label' }, 'What does this mean?'), h('div', { class: 'ex-sentence' }, urduLine(word, { big: true })), list.el, after),
    );
    return;
  }

  // production
  const p = productionPrompt(word);
  const after = h('div', { class: 'ex-after' });
  ctx.body.append(
    header('Now the other way round'),
    h(
      'section',
      { class: 'card exercise' },
      h('p', { class: 'ex-label' }, p.label),
      h('p', { class: 'ex-en-big' }, p.text),
      p.note ? h('p', { class: 'muted small' }, p.note) : null,
      freeAnswer({
        scope: ctx.scope,
        modes: ['speak', 'type'],
        mode: startMode({ type: 'translate' }, store.data.settings.answerMode),
        answers: productionAnswers(word),
        model: [{ roman: word.roman, ur: word.ur, en: word.meaning_en }],
        loanwords: ctx.loanwords,
        onFinish: (correct) =>
          ctx.setActions(h('button', { class: 'btn', type: 'button', onclick: () => ctx.complete((run, sec) => addSec(recordWord(run, wordId, { prod: correct }), wordId, sec)) }, 'Continue')),
      }),
      after,
    ),
  );
}
