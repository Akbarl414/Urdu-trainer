// Content validation: JSON Schema (draft-07) plus the cross-file and
// romanization rules from PLAN.md §4.3. Pure: takes an in-memory bundle so the
// tests can feed it hand-made content.

import { checkRoman, checkUrdu, checkLoanwordRoman, containsBlank } from '../../src/lang/romanization.js';

const LESSON_NUM = /^lesson-(\d{3})$/;
const UNIT_NUM = /^unit-(\d{2})$/;
const MAX_WORDS_PER_UNIT = 80;

/** Keys whose string (or string-array) values are Roman Urdu. */
const ROMAN_KEYS = new Set(['roman', 'answer', 'altAnswers', 'tokens', 'answerOrders', 'forms', 'speaker']);
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
        if (isUrKey(k) && typeof v === 'string') {
          for (const m of checkUrdu(v, { allowBlank: true })) err(it, `${here} ("${v}") ${m}`);
          continue;
        }
        if ((k === 'body' || k === 'heading' || k === 'notes' || k === 'explanation') && typeof v === 'string') {
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
    });
  }

  // ---- 4. lessons -------------------------------------------------------
  const introducedCount = new Map();
  for (const l of lessons) {
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
      checkExercise(l, e, `exercises[${i}] (${e.id})`);
    });
    const gids = new Set();
    (d.game_items || []).forEach((g) => {
      if (gids.has(g.id)) err(l, `duplicate game item id "${g.id}"`);
      gids.add(g.id);
    });
    checkTree(l, { grammar: d.grammar, dialogue: d.dialogue, exercises: d.exercises, game_items: d.game_items }, '', d.order);
  }
  for (const [wid, byLessons] of introducedCount) {
    if (byLessons.length > 1) errors.push(`word "${wid}" is introduced by more than one lesson: ${byLessons.join(', ')}`);
  }
  for (const [wid, { vocab }] of wordById) {
    if (!introducedCount.has(wid)) err(vocab, `word "${wid}" is not listed in any lesson's new_vocab (every word is introduced exactly once)`);
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
