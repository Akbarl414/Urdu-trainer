// Content validation: JSON Schema (draft-07) plus the cross-file and
// romanization rules from PLAN.md §4.3. Pure: takes an in-memory bundle so the
// tests can feed it hand-made content.

import { checkRoman, checkUrdu, checkLoanwordRoman, containsBlank } from '../../src/lang/romanization.js';
import { practiceTiles, PRACTICE_MIN_TILES, PRACTICE_MAX_TILES } from '../../src/games/practice.js';

const LESSON_NUM = /^lesson-(\d{3})$/;
const UNIT_NUM = /^unit-(\d{2})$/;
const MAX_WORDS_PER_UNIT = 80;

/** Keys whose string (or string-array) values are Roman Urdu. */
const ROMAN_KEYS = new Set(['roman', 'answer', 'altAnswers', 'tokens', 'answerOrders', 'forms']);
/** English prose keys: Urdu inside `backticks` is checked against the scheme. */
const PROSE_KEYS = new Set(['body', 'heading', 'notes', 'explanation', 'hint', 'setting', 'situation', 'literal', 'instruction', 'prompt', 'note', 'question']);
/** Exercise fields a learner_f override may not replace (D23). */
const FIXED_EXERCISE_KEYS = ['id', 'type', 'tags', 'retired', 'sentence_card', 'learner_f'];
const isUrKey = (k) => k === 'ur' || k.endsWith('_ur');

const lessonNumber = (id) => Number(LESSON_NUM.exec(id)?.[1] ?? NaN);

function kebabOf(roman) {
  return roman.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '');
}

/** All ids in a bundle as namespaced strings, for the lockfile. */
export function collectIds({ units = [], vocabs = [], lessons = [] }) {
  const ids = new Set();
  for (const { data } of units) if (data?.id) ids.add(`unit:${data.id}`);
  for (const { data } of vocabs) {
    if (data?.id) ids.add(`vocab:${data.id}`);
    for (const w of data?.words || []) if (w?.id) ids.add(`word:${w.id}`);
  }
  for (const { data } of lessons) {
    if (!data?.id) continue;
    ids.add(`lesson:${data.id}`);
    for (const e of data.exercises || []) if (e?.id) ids.add(`exercise:${data.id}/${e.id}`);
    for (const g of data.game_items || []) if (g?.id) ids.add(`game-item:${data.id}/${g.id}`);
    for (const p of data.practice_sentences || []) if (p?.id) ids.add(`practice:${data.id}/${p.id}`);
  }
  return ids;
}

/**
 * @param {{ units: any[], vocabs: any[], lessons: any[], problems?: string[] }} bundle items are { file, dir, data, rel? }
 * @param {{ ajv: import('ajv').default, shippedIds?: string[] }} ctx
 * @returns {{ errors: string[], warnings: string[], unlockedIds: string[], stats: object }}
 */
export function checkContent(bundle, { ajv, shippedIds = [] }) {
  const errors = [...(bundle.problems || [])];
  const warnings = [];
  const label = (it) => it.rel || `units/${it.dir}/${it.file}`;
  const err = (it, msg) => errors.push(`${label(it)}: ${msg}`);

  // ---- 1. schemas -------------------------------------------------------
  const schemaOk = new Set();
  const runSchema = (items, schemaId) => {
    const validate = ajv.getSchema(schemaId);
    for (const it of items) {
      if (validate(it.data)) {
        schemaOk.add(it);
      } else {
        for (const e of validate.errors) err(it, `${e.instancePath || '(root)'} ${e.message}${e.params?.additionalProperty ? ` "${e.params.additionalProperty}"` : ''}`);
      }
    }
  };
  runSchema(bundle.units, 'unit.schema.json');
  runSchema(bundle.vocabs, 'vocab.schema.json');
  runSchema(bundle.lessons, 'lesson.schema.json');

  const units = bundle.units.filter((u) => schemaOk.has(u));
  const vocabs = bundle.vocabs.filter((v) => schemaOk.has(v));
  const lessons = bundle.lessons.filter((l) => schemaOk.has(l));

  // ---- 2. ids match filenames; global uniqueness ----------------------------
  const seen = new Map(); // id -> label
  const claim = (it, id, kind) => {
    const key = id;
    if (seen.has(key)) err(it, `duplicate id "${id}" (${kind}); also used by ${seen.get(key)}`);
    else seen.set(key, `${label(it)} (${kind})`);
  };
  const unitById = new Map();
  for (const it of units) {
    const { id, order } = it.data;
    if (id !== it.dir) err(it, `id "${id}" does not match its folder "${it.dir}"`);
    if (order !== Number(UNIT_NUM.exec(id)?.[1])) err(it, `order ${order} does not match the number in the id "${id}"`);
    claim(it, id, 'unit');
    unitById.set(id, it);
  }
  for (const it of vocabs) {
    const { id, unit } = it.data;
    if (id !== `vocab-${it.dir}`) err(it, `id "${id}" should be "vocab-${it.dir}"`);
    if (unit !== it.dir) err(it, `unit "${unit}" does not match its folder "${it.dir}"`);
    if (!unitById.has(unit)) err(it, `unit "${unit}" has no unit.json`);
    claim(it, id, 'vocab file');
  }
  const lessonById = new Map();
  for (const it of lessons) {
    const { id, unit, order } = it.data;
    if (`${id}.json` !== it.file) err(it, `id "${id}" does not match the filename`);
    if (unit !== it.dir) err(it, `unit "${unit}" does not match its folder "${it.dir}"`);
    if (!unitById.has(unit)) err(it, `unit "${unit}" has no unit.json`);
    if (order !== lessonNumber(id)) err(it, `order ${order} does not match the number in the id "${id}"`);
    claim(it, id, 'lesson');
    lessonById.set(id, it);
  }

  // ---- 3. words ---------------------------------------------------------
  const wordById = new Map(); // id -> { word, vocab }
  for (const v of vocabs) {
    if (v.data.words.length > MAX_WORDS_PER_UNIT) err(v, `${v.data.words.length} words/phrases; a unit holds at most ${MAX_WORDS_PER_UNIT}`);
    for (const word of v.data.words) {
      if (wordById.has(word.id)) {
        err(v, `duplicate word id "${word.id}" (also in ${label(wordById.get(word.id).vocab)})`);
        continue;
      }
      if (word.id.startsWith('seed-')) err(v, `word id "${word.id}": the "seed-" prefix is reserved for the removed Phase 2 test cards (PLAN D21)`);
      claim(v, word.id, 'word');
      wordById.set(word.id, { word, vocab: v });
    }
  }

  // Loanword exemption sets, by lesson order: entries introduced in this or an earlier lesson.
  const loanEntries = []; // { order, entries: string[] }
  for (const { word } of wordById.values()) {
    if (!word.loanword) continue;
    loanEntries.push({ order: lessonNumber(word.introduced_in), entries: [word.roman, ...(word.forms || [])] });
  }
  const exemptCache = new Map();
  const exemptFor = (order) => {
    if (!exemptCache.has(order)) {
      const set = new Set();
      for (const l of loanEntries) if (l.order <= order) l.entries.forEach((e) => set.add(e));
      exemptCache.set(order, set);
    }
    return exemptCache.get(order);
  };

  // Generic walker over one content object: roman / Urdu / prose checks.
  const checkTree = (it, node, path, order, skipTop = false) => {
    const exempt = exemptFor(order);
    const romanProblems = (value, p) => {
      for (const m of checkRoman(value, { allowBlank: true, exempt })) err(it, `${p} ("${value}") ${m}`);
    };
    const walk = (n, p, top) => {
      if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${p}[${i}]`, false));
      if (n === null || typeof n !== 'object') return;
      for (const [k, v] of Object.entries(n)) {
        const here = `${p}.${k}`;
        if (ROMAN_KEYS.has(k) && !(top && skipTop && (k === 'roman' || k === 'forms'))) {
          const flat = Array.isArray(v) ? v.flat(2) : [v];
          flat.forEach((s, i) => {
            if (typeof s === 'string') romanProblems(s, Array.isArray(v) ? `${here}[${i}]` : here);
          });
          continue;
        }
        if (k === 'ur_alt' && Array.isArray(v)) {
          v.forEach((u, i) => checkUrdu(u).forEach((m) => err(it, `${here}[${i}] ("${u}") ${m}`)));
          continue;
        }
        if (isUrKey(k) && typeof v === 'string') {
          for (const m of checkUrdu(v, { allowBlank: true })) err(it, `${here} ("${v}") ${m}`);
          continue;
        }
        if (PROSE_KEYS.has(k) && typeof v === 'string') {
          checkProse(it, v, here, exempt);
          continue;
        }
        if (k === 'rows' && Array.isArray(v)) {
          v.forEach((row, ri) => row.forEach((cell, ci) => (typeof cell === 'string' ? checkProse(it, cell, `${here}[${ri}][${ci}]`, exempt) : walk(cell, `${here}[${ri}][${ci}]`, false))));
          continue;
        }
        if (k === 'headers' && Array.isArray(v)) {
          v.forEach((cell, ci) => checkProse(it, cell, `${here}[${ci}]`, exempt));
          continue;
        }
        walk(v, here, false);
      }
    };
    walk(node, path, true);
  };

  function checkProse(it, text, path, exempt) {
    for (const m of text.matchAll(/`([^`]+)`/g)) {
      for (const problem of checkRoman(m[1], { allowBlank: true, exempt })) err(it, `${path}: \`${m[1]}\` ${problem}`);
    }
  }

  for (const v of vocabs) {
    v.data.words.forEach((word, i) => {
      const path = `words[${i}] (${word.id})`;
      const order = lessonNumber(word.introduced_in);
      if (word.loanword) {
        for (const m of checkLoanwordRoman(word.roman)) err(v, `${path}.roman ("${word.roman}") ${m}`);
        (word.forms || []).forEach((f, fi) => checkLoanwordRoman(f).forEach((m) => err(v, `${path}.forms[${fi}] ("${f}") ${m}`)));
        checkTree(v, word, path, order, true);
      } else {
        checkTree(v, word, path, order);
      }
      const base = kebabOf(word.roman);
      if (base && !word.id.startsWith(base)) warnings.push(`${label(v)}: ${path} id does not start with the kebab-case of its roman ("${base}"). Fine if the roman was corrected later: ids never change.`);
      const intro = lessonById.get(word.introduced_in);
      if (!intro) err(v, `${path} introduced_in "${word.introduced_in}" is not a known lesson`);
      else {
        if (intro.data.unit !== v.data.unit) err(v, `${path} is introduced in ${word.introduced_in}, which belongs to ${intro.data.unit}, not ${v.data.unit}`);
        if (!intro.data.new_vocab.includes(word.id)) err(v, `${path} says it is introduced in ${word.introduced_in}, but that lesson's new_vocab does not list it`);
      }
      checkForms(v, word, path);
      if (word.ur_alt?.includes(word.ur)) err(v, `${path}.ur_alt repeats ur; list only other spellings`);
    });
  }

  // Inflection fields feed games that generate phrases (PLAN §8), so the regular patterns are checked.
  function checkForms(v, word, path) {
    const ends = (pair, roman, ur) => pair.roman.endsWith(roman) && (ur === null || pair.ur.endsWith(ur));
    if (word.pos === 'noun') {
      if (word.marked && word.gender !== 'm') err(v, `${path} is marked, so it must be masculine (gender "m")`);
      if (word.mass && word.plural_only) err(v, `${path} cannot be both mass and plural_only`);
      if (word.invariable) {
        if (!word.loanword) err(v, `${path} is invariable, which is only for English loanwords that never take Urdu endings`);
        if (word.plural || word.oblique_pl) err(v, `${path} is invariable: leave out plural and oblique_pl (the roman is used for all of them)`);
        if (word.marked || word.mass || word.plural_only || word.plural_rare) err(v, `${path} is invariable, so it cannot also be marked, mass, plural_only or plural_rare`);
      }
      if (word.plural_rare && !(word.plural && word.oblique_pl)) err(v, `${path} is plural_rare but lists no plural / oblique_pl`);
      if (word.marked && word.plural && word.oblique_pl) {
        const stem = word.roman.replace(/aa$/, '');
        if (!word.roman.endsWith('aa')) err(v, `${path} is marked but its roman does not end in "aa"`);
        else {
          if (word.plural.roman !== `${stem}e` || !/ے$/.test(word.plural.ur)) err(v, `${path}.plural should be "${stem}e" (ending in ے) for a marked noun`);
          if (word.oblique_pl.roman !== `${stem}oN` || !/وں$/.test(word.oblique_pl.ur)) err(v, `${path}.oblique_pl should be "${stem}oN" (ending in وں) for a marked noun`);
        }
      } else if (word.plural && word.oblique_pl && word.gender === 'f') {
        const ii = word.roman.endsWith('ii');
        const want = ii ? `${word.roman.slice(0, -2)}iyaaN` : `${word.roman}eN`;
        if (word.plural.roman !== want) warnings.push(`${label(v)}: ${path}.plural is "${word.plural.roman}"; the regular feminine plural would be "${want}". Fine if it is a real exception.`);
      } else if (word.plural && !word.marked && (word.gender === 'm' || word.plural_only) && word.plural.roman !== word.roman && !word.loanword) {
        warnings.push(`${label(v)}: ${path}.plural "${word.plural.roman}" differs from the singular; unmarked masculine nouns normally don't change. Fine if it is a real exception.`);
      }
      // After a long -uu the waw carries a hamza: ابو → ابوؤں, آلو → آلوؤں.
      if (word.oblique_pl && !(ends(word.oblique_pl, 'oN', 'وں') || ends(word.oblique_pl, 'uuoN', 'وؤں'))) err(v, `${path}.oblique_pl should end in "oN" / وں (ؤں after a long -uu)`);
    }
    if (word.pos !== 'noun') for (const k of ['invariable', 'plural_rare']) if (word[k] !== undefined) err(v, `${path}: "${k}" is only for nouns`);
    if (word.variable !== undefined && ['noun', 'verb', 'phrase', 'adverb'].includes(word.pos)) err(v, `${path}: "variable" is only for adjectives, pronouns, postpositions and other (a ${word.pos} doesn't agree like acchaa)`);
    if (word.agreement) {
      if (!word.variable) err(v, `${path} has agreement forms but variable is not true`);
      const { m_sg, f, m_pl } = word.agreement;
      if (m_sg.roman !== word.roman) err(v, `${path}.agreement.m_sg.roman ("${m_sg.roman}") should equal the word's roman ("${word.roman}")`);
      if (!m_sg.roman.endsWith('aa')) err(v, `${path}.agreement.m_sg should end in "aa"`);
      else {
        const stem = m_sg.roman.slice(0, -2);
        if (f.roman !== `${stem}ii` || !/ی$/.test(f.ur)) err(v, `${path}.agreement.f should be "${stem}ii" (ending in ی)`);
        if (m_pl.roman !== `${stem}e` || !/ے$/.test(m_pl.ur)) err(v, `${path}.agreement.m_pl should be "${stem}e" (ending in ے)`);
      }
    }
  }

  function checkDialogue(l, dialogue) {
    const ids = new Set();
    let learners = 0;
    dialogue.speakers.forEach((sp, i) => {
      if (ids.has(sp.id)) err(l, `dialogue.speakers[${i}] duplicate speaker id "${sp.id}"`);
      ids.add(sp.id);
      if (sp.learner) learners++;
      else if (!sp.gender) err(l, `dialogue.speakers[${i}] (${sp.id}) needs a gender (only the learner's role has none)`);
    });
    if (learners > 1) err(l, `dialogue has ${learners} learner speakers; at most one`);
    const learnerIds = new Set(dialogue.speakers.filter((sp) => sp.learner).map((sp) => sp.id));
    const used = new Set();
    dialogue.lines.forEach((line, i) => {
      if (!ids.has(line.speaker)) err(l, `dialogue.lines[${i}].speaker "${line.speaker}" is not in dialogue.speakers`);
      used.add(line.speaker);
      if (!learnerIds.has(line.speaker)) {
        if (line.learner_f) err(l, `dialogue.lines[${i}].learner_f is only for the learner's own lines (speaker "${line.speaker}" has a fixed gender)`);
        if (line.options) err(l, `dialogue.lines[${i}].options is only for the learner's own lines (other speakers get a "check" question)`);
        if (!line.check) err(l, `dialogue.lines[${i}] needs a "check" question: the learner hears this line and answers it before seeing the text (PLAN D31)`);
        else {
          const { options, answerIndex } = line.check;
          if (answerIndex >= options.length) err(l, `dialogue.lines[${i}].check.answerIndex ${answerIndex} is out of range`);
          if (new Set(options).size !== options.length) err(l, `dialogue.lines[${i}].check.options has duplicates`);
          if (options.some((o) => o.includes('('))) err(l, `dialogue.lines[${i}].check.options contains "(" — annotated options give the answer away`);
        }
        return;
      }
      if (line.check) err(l, `dialogue.lines[${i}].check is only for other speakers' lines`);
      const romans = (line.options || []).map((o) => o.roman);
      if (new Set(romans).size !== romans.length) err(l, `dialogue.lines[${i}].options has duplicates`);
      if (romans.includes(line.roman)) err(l, `dialogue.lines[${i}].options repeats the line itself; list only the other options`);
      if (line.learner_f?.options && line.learner_f.options.some((o) => o.roman === line.learner_f.roman)) err(l, `dialogue.lines[${i}].learner_f.options repeats the woman's line; list only the other options`);
      if (line.options && line.learner_f && !line.learner_f.options) warnings.push(`${label(l)}: dialogue.lines[${i}] has options and learner_f but no learner_f.options; the woman's choice uses the man's wrong answers.`);
      if (line.learner_f) {
        if (line.learner_f.roman === line.roman) warnings.push(`${label(l)}: dialogue.lines[${i}].learner_f.roman is the same as the base line`);
      } else if (gendered(line.roman)) {
        warnings.push(`${label(l)}: dialogue.lines[${i}] is the learner speaking about themselves with a form that may change for a woman ("${gendered(line.roman)}"). Add learner_f if a woman says it differently.`);
      }
    });
    for (const id of ids) if (!used.has(id)) warnings.push(`${label(l)}: dialogue speaker "${id}" has no lines`);
  }

  // ---- learner gender (D23) ----------------------------------------------
  // Vocab forms that change with the speaker's gender, plus habitual/future/progressive endings.
  const genderedForms = new Set();
  for (const { word } of wordById.values()) {
    for (const p of [word.agreement?.m_sg, word.agreement?.f, word.perfective?.m_sg, word.perfective?.f_sg]) if (p?.roman) genderedForms.add(p.roman);
  }
  const GENDERED_WORDS = new Set(['thaa', 'thii', 'rahaa', 'rahii', 'gayaa', 'gayii']);
  /** The first gendered token in a first-person sentence ("maiN … huuN"), or null. */
  function gendered(text) {
    for (const sentence of String(text).split(/[.?!…]/)) {
      const toks = sentence.replace(/[,;:"()-]/g, ' ').split(/\s+/).filter(Boolean);
      if (!toks.includes('maiN') && !toks.includes('huuN')) continue;
      const hit = toks.find((t) => genderedForms.has(t) || GENDERED_WORDS.has(t) || (t.length > 4 && /(taa|tii|ngaa|ngii)$/.test(t)));
      if (hit) return hit;
    }
    return null;
  }
  const romanStrings = (node) => {
    const out = [];
    const walk = (n, key) => {
      if (Array.isArray(n)) return n.forEach((x) => walk(x, key));
      if (typeof n === 'string') return void (ROMAN_KEYS.has(key) && out.push(n));
      if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) if (k !== 'learner_f') walk(v, k);
    };
    walk(node, '');
    return out;
  };

  function checkLearnerVariant(l, e, path) {
    if (!e.learner_f) {
      // A blank hides the gendered word, so also read the sentence with the answer filled in.
      const filled = [];
      if (e.sentence?.roman && e.answer) filled.push(e.sentence.roman.replace('___', e.answer));
      if (e.sentence?.roman && e.type === 'choose-form') filled.push(e.sentence.roman.replace('___', e.options[e.answerIndex]?.roman ?? ''));
      const hit = [...romanStrings(e), ...filled].map(gendered).find(Boolean);
      if (hit) warnings.push(`${label(l)}: ${path} has the learner speaking about themselves with a form that may change for a woman ("${hit}"). Add learner_f if a woman says it differently.`);
      return;
    }
    const bad = FIXED_EXERCISE_KEYS.filter((k) => k in e.learner_f);
    if (bad.length) return err(l, `${path}.learner_f may not replace ${bad.join(', ')}`);
    const { learner_f: f, ...base } = e;
    const merged = { ...base, ...f };
    const validate = ajv.getSchema(`exercise.schema.json#/definitions/${e.type}`);
    if (validate && !validate(merged)) {
      for (const x of validate.errors) err(l, `${path} (woman's version) ${x.instancePath || '(root)'} ${x.message}${x.params?.additionalProperty ? ` "${x.params.additionalProperty}"` : ''}`);
      return;
    }
    checkExercise(l, merged, `${path} (woman's version)`);
    if (JSON.stringify(merged) === JSON.stringify(base)) warnings.push(`${label(l)}: ${path}.learner_f changes nothing`);
  }

  // ---- 4. lessons -------------------------------------------------------
  const neOrders = lessons.filter((l) => (l.data.unlocks || []).includes('ne')).map((l) => l.data.order);
  const neFrom = neOrders.length ? Math.min(...neOrders) : null;
  const introducedCount = new Map();
  const practiceSeen = new Map(); // tile key -> where it first appeared
  const reorderKeys = new Set(lessons.flatMap((l) => l.data.exercises.filter((e) => e.type === 'reorder').map((e) => practiceTiles(e.sentence.roman).join(' '))));
  for (const l of [...lessons].sort((a, b) => a.data.order - b.data.order)) {
    const d = l.data;
    const n = d.new_vocab.length;
    if (d.review ? n > 4 : n < 6) err(l, d.review ? `review lessons introduce at most 4 new items (has ${n})` : `lessons introduce 6–10 new items (has ${n})`);
    for (const wid of d.new_vocab) {
      const entry = wordById.get(wid);
      if (!entry) {
        err(l, `new_vocab references unknown word id "${wid}"`);
        continue;
      }
      introducedCount.set(wid, [...(introducedCount.get(wid) || []), d.id]);
      if (entry.word.introduced_in !== d.id) err(l, `new_vocab "${wid}" has introduced_in "${entry.word.introduced_in}", expected "${d.id}"`);
    }
    const exIds = new Set();
    d.exercises.forEach((e, i) => {
      if (exIds.has(e.id)) err(l, `exercises[${i}] duplicate exercise id "${e.id}"`);
      exIds.add(e.id);
      const path = `exercises[${i}] (${e.id})`;
      checkExercise(l, e, path);
      checkLearnerVariant(l, e, path);
    });
    // Sentence cards (PLAN D28): 2–3 per lesson are reviewed; the other exercises stay in the lesson and practice replay.
    const flagged = d.exercises.filter((e) => e.sentence_card && !e.retired);
    if (flagged.length > 3 || (!d.review && flagged.length < 2)) err(l, `lessons flag 2–3 exercises as sentence_card (has ${flagged.length})`);
    for (const e of flagged) if (e.type === 'listen') err(l, `exercise ${e.id}: a listen exercise can't be a sentence_card (a voice may not be available)`);
    if (neFrom !== null && d.order >= neFrom && !flagged.some((e) => (e.tags || []).includes('ne'))) warnings.push(`${label(l)}: no sentence_card is tagged "ne"; ne/no-ne is practised through sentence cards from lesson ${neFrom} on.`);
    const gids = new Set();
    (d.game_items || []).forEach((g) => {
      if (gids.has(g.id)) err(l, `duplicate game item id "${g.id}"`);
      gids.add(g.id);
    });
    checkDialogue(l, d.dialogue);
    checkPractice(l, d);
    checkTree(l, { grammar: d.grammar, dialogue: d.dialogue, exercises: d.exercises, game_items: d.game_items, practice_sentences: d.practice_sentences }, '', d.order);
  }
  for (const [wid, byLessons] of introducedCount) {
    if (byLessons.length > 1) errors.push(`word "${wid}" is introduced by more than one lesson: ${byLessons.join(', ')}`);
  }
  for (const [wid, { vocab }] of wordById) {
    if (!introducedCount.has(wid)) err(vocab, `word "${wid}" is not listed in any lesson's new_vocab (every word is introduced exactly once)`);
  }

  // Practice sentences (PLAN D36): game material only. Variety is the point, so an exact repeat is an error.
  function checkPractice(l, d) {
    const key = (roman) => practiceTiles(roman).join(' ');
    const ids = new Set();
    (d.practice_sentences || []).forEach((p, i) => {
      const path = `practice_sentences[${i}] (${p.id})`;
      if (ids.has(p.id)) err(l, `${path}: duplicate id`);
      ids.add(p.id);
      const k = key(p.roman);
      const elsewhere = practiceSeen.get(k);
      if (elsewhere) err(l, `${path} ("${p.roman}") repeats ${elsewhere}`);
      else practiceSeen.set(k, `${d.id}/${p.id}`);
      if (reorderKeys.has(k)) err(l, `${path} ("${p.roman}") repeats a reorder exercise`);
      const tilesOk = (roman, orders, where) => {
        const tiles = practiceTiles(roman);
        if (tiles.length < PRACTICE_MIN_TILES || tiles.length > PRACTICE_MAX_TILES) err(l, `${where} has ${tiles.length} tiles; practice sentences have ${PRACTICE_MIN_TILES}-${PRACTICE_MAX_TILES}`);
        const want = [...tiles].sort().join('\u0000');
        (orders || []).forEach((order, n) => {
          if ([...order].sort().join('\u0000') !== want) err(l, `${where}.alt_orders[${n}] is not a permutation of the tiles of "${roman}"`);
        });
      };
      tilesOk(p.roman, p.alt_orders, path);
      if (p.learner_f) {
        if (p.learner_f.roman === p.roman) warnings.push(`${label(l)}: ${path}.learner_f.roman is the same as the base`);
        tilesOk(p.learner_f.roman, p.learner_f.alt_orders ?? p.alt_orders, `${path} (woman's version)`);
      } else if (gendered(p.roman)) {
        warnings.push(`${label(l)}: ${path} has the learner speaking about themselves with a form that may change for a woman ("${gendered(p.roman)}"). Add learner_f if a woman says it differently.`);
      }
    });
  }

  function checkExercise(l, e, path) {
    const sorted = (a) => [...a].sort().join('\u0000');
    if (e.type === 'fill-blank') {
      if (!containsBlank(e.sentence.roman)) err(l, `${path}.sentence.roman needs a ___ blank`);
      if (!containsBlank(e.sentence.ur)) err(l, `${path}.sentence.ur needs a ___ blank`);
    }
    if (e.type === 'choose-form' && !containsBlank(e.sentence.roman)) err(l, `${path}.sentence.roman needs a ___ blank`);
    if (e.type === 'reorder') {
      const want = sorted(e.tokens);
      e.answerOrders.forEach((order, i) => {
        if (sorted(order) !== want) err(l, `${path}.answerOrders[${i}] is not a permutation of tokens`);
      });
    }
    if (e.options && e.answerIndex !== undefined) {
      if (e.answerIndex >= e.options.length) err(l, `${path}.answerIndex ${e.answerIndex} is out of range (${e.options.length} options)`);
      for (const a of e.acceptIndexes ?? []) {
        if (a >= e.options.length) err(l, `${path}.acceptIndexes ${a} is out of range (${e.options.length} options)`);
        if (a === e.answerIndex) err(l, `${path}.acceptIndexes repeats answerIndex`);
      }
      e.options.forEach((o, i) => {
        const text = typeof o === 'string' ? o : `${o.roman ?? ''} ${o.en ?? ''}`;
        if (text.includes('(')) err(l, `${path}.options[${i}] contains "(" — annotated options give the answer away`);
      });
    }
  }

  // ---- 5. id lockfile ---------------------------------------------------
  const current = collectIds({ units: bundle.units, vocabs: bundle.vocabs, lessons: bundle.lessons });
  for (const id of shippedIds) {
    if (!current.has(id)) errors.push(`shipped id "${id}" no longer exists. Ids never change once shipped: restore it, and set "retired": true to retire content instead of deleting it.`);
  }
  const locked = new Set(shippedIds);
  const unlockedIds = [...current].filter((id) => !locked.has(id)).sort();

  return {
    errors,
    warnings,
    unlockedIds,
    stats: { units: bundle.units.length, vocabFiles: bundle.vocabs.length, lessons: bundle.lessons.length, words: wordById.size },
  };
}
