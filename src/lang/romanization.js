// The Roman Urdu scheme rules (content/ROMANIZATION.md §6), shared by the
// content validator and (later) the app. Pure: no DOM, no Node APIs.

const VOWELS = 'aeiou';
const ALLOWED_PUNCT = new Set(['.', ',', '?', '!', '…', ';', ':', '"', '(', ')', '-', ' ']);
const ALLOWED_CAPITALS = new Set(['T', 'D', 'R', 'N', 'G']);
const BLANK = '___';

/** A loanword token: lowercase English letters, hyphens, plus an optional Urdu-ending nasal `N` (buseN). */
const LOANWORD_TOKEN = /^[a-z]+(?:-[a-z]+)*N?$/;

/**
 * Check one Roman Urdu string against the scheme.
 * @param {string} text
 * @param {{ allowBlank?: boolean, exempt?: Set<string> }} [opts]
 *   exempt: loanword entries (single tokens or multi-word forms like "doctoroN ko")
 *   whose spelling is exempt from the scheme. They must still be lowercase.
 * @returns {string[]} human-readable problems; empty means valid
 */
export function checkRoman(text, { allowBlank = false, exempt = new Set() } = {}) {
  const problems = [];
  if (typeof text !== 'string' || text.trim() === '') return ['is empty'];
  if (/[؀-ۿ]/.test(text)) return ['contains Urdu script (roman fields must be Roman Urdu)'];

  const work = allowBlank ? text.split(BLANK).join(' ') : text;

  // Whitespace-separated tokens with surrounding punctuation stripped, for the exemption lookup.
  const rawTokens = work.split(/\s+/).filter(Boolean);
  const stripped = rawTokens.map((t) => t.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''));

  const exemptIdx = new Set();
  const maxLen = 4;
  for (let i = 0; i < stripped.length; i++) {
    for (let len = Math.min(maxLen, stripped.length - i); len >= 1; len--) {
      // Multi-word forms: only inner punctuation matters, so compare stripped tokens.
      const candidate = stripped.slice(i, i + len).join(' ');
      if (exempt.has(candidate)) {
        for (let j = i; j < i + len; j++) exemptIdx.add(j);
        i += len - 1;
        break;
      }
    }
  }

  rawTokens.forEach((raw, idx) => {
    if (exemptIdx.has(idx)) {
      const core = stripped[idx];
      if (!LOANWORD_TOKEN.test(core)) problems.push(`loanword "${core}" must be lowercase English letters (an Urdu ending may add a final N)`);
      for (const ch of raw.replace(core, '')) {
        if (!ALLOWED_PUNCT.has(ch)) problems.push(`character "${ch}" is not allowed`);
      }
      return;
    }
    problems.push(...checkToken(raw));
  });

  return [...new Set(problems)];
}

function checkToken(token) {
  const problems = [];
  // 1. Characters
  for (const ch of token) {
    if (ch >= 'a' && ch <= 'z') {
      if (ch === 'v') problems.push('"v" is not used (write "w": wo, waqt)');
    } else if (ch >= 'A' && ch <= 'Z') {
      if (!ALLOWED_CAPITALS.has(ch)) problems.push(`capital "${ch}" is not allowed; only T D R N and Gh are capitalised (capitals are phonetic, never grammatical)`);
    } else if (!ALLOWED_PUNCT.has(ch)) {
      problems.push(`character "${ch}" is not allowed`);
    }
  }

  // Check word by word (hyphens split words: assalaam-o-alaikum).
  for (const word of token.split(/[^A-Za-z]+/).filter(Boolean)) {
    // 2. G only as Gh
    for (let i = 0; i < word.length; i++) {
      if (word[i] === 'G' && word[i + 1] !== 'h') problems.push('"G" is only allowed as "Gh"');
    }
    // 3. N only after a vowel and at the end of a word
    for (let i = 0; i < word.length; i++) {
      if (word[i] !== 'N') continue;
      if (i !== word.length - 1) problems.push(`"N" only marks a word-final nasal vowel; write plain "n" inside a word ("${word}")`);
      else if (i === 0 || !VOWELS.includes(word[i - 1])) problems.push(`"N" must directly follow a vowel ("${word}")`);
    }
    // 4. c only as ch / cch
    for (let i = 0; i < word.length; i++) {
      if (word[i] !== 'c') continue;
      const ok = word[i + 1] === 'h' || (word[i + 1] === 'c' && word[i + 2] === 'h');
      if (!ok) problems.push(`"c" is only used in "ch" or "cch" ("${word}")`);
    }
    // 5. no ee / oo / tripled vowels
    if (/ee/.test(word)) problems.push(`"ee" is not used; long i is "ii" ("${word}")`);
    if (/oo/.test(word)) problems.push(`"oo" is not used; long u is "uu" ("${word}")`);
    if (/([aeiou])\1\1/.test(word)) problems.push(`tripled vowel in "${word}"`);
  }
  return problems;
}

/** Validates the roman of a loanword entry itself (or one of its `forms`). */
export function checkLoanwordRoman(text) {
  if (typeof text !== 'string' || text.trim() === '') return ['is empty'];
  const problems = [];
  for (const part of text.split(/\s+/).filter(Boolean)) {
    if (!LOANWORD_TOKEN.test(part)) problems.push(`loanword "${part}" must be lowercase English letters (an Urdu ending may add a final N)`);
  }
  return problems;
}

export function containsBlank(text) {
  return typeof text === 'string' && text.includes(BLANK);
}

// ---------------------------------------------------------------- Urdu script ("ur") checks

/** Arabic look-alikes that must never appear in Urdu text, mapped to the Urdu letter to use. */
export const ARABIC_LOOKALIKES = {
  'ي': 'ی (ی, Urdu ye)', // ي
  'ك': 'ک (ک, Urdu kaf)', // ك
  'ه': 'ہ (ہ, Urdu he)', // ه
  'ى': 'ی (ی, Urdu ye)', // ى alef maksura
  'ة': 'ۃ (ۃ) or ت (ت)', // ة
};

const ARABIC_RANGE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

/**
 * Check a Urdu-script string. A blank marker `___` is tolerated when allowBlank.
 * @returns {string[]} problems; empty means valid
 */
export function checkUrdu(text, { allowBlank = false } = {}) {
  if (typeof text !== 'string' || text.trim() === '') return ['is empty'];
  const problems = [];
  const body = allowBlank ? text.split(BLANK).join(' ') : text;
  if (!ARABIC_RANGE.test(body)) problems.push('contains no Urdu-script characters');
  if (/[A-Za-z]/.test(body)) problems.push('contains Latin letters (Roman Urdu belongs in "roman")');
  for (const ch of body) {
    if (ARABIC_LOOKALIKES[ch]) {
      problems.push(`Arabic look-alike U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} — use ${ARABIC_LOOKALIKES[ch]}`);
    }
  }
  for (const ch of body) {
    if (/[A-Za-z]/.test(ch) || ARABIC_RANGE.test(ch) || /\s/.test(ch) || '\u200C\u200D.,?!…;:"()-'.includes(ch)) continue;
    problems.push(`character "${ch}" is not allowed in Urdu text`);
  }
  return [...new Set(problems)];
}
