// Answer matching for typed Roman Urdu (content/ROMANIZATION.md §7, PLAN §5.5). Pure.
//
//   exact   same letters AND capitals, ignoring punctuation and extra spaces (hyphen = space).
//   close   counts as correct, but the exact form is shown with the differences highlighted:
//           capitals ignored (T/t, D/d, R/r, Gh/gh), a nasal `N` in the expected word is optional (huuN ~ hun ~ hu; but a plain
//           consonant n is not: din ≠ dii, jaan ≠ jaa),
//           vowel length ignored (aa~a, ii~i, uu~u), doubled consonants ignored (pakkaa ~ pakaa),
//           and the common phone spellings (theek, hoon, mein, hain, nahin, vo).
//   wrong   anything else.
//
// What must NEVER blur is an ending that carries grammar: laRkaa / laRkii / laRke,
// gayaa / gayii / gaye, kaa / kii / ke. Folding only shortens long vowels, so aa/ii/e stay
// distinct (a / i / e). tests/normalise.test.js pins every one of these pairs.

const PUNCT = /[.,?!…;:"'“”‘’()[\]]/g;

/** Phone spellings the letter rules below can't reach (hain, nahin, hoon, theek, vo all fold by rule). */
const PHONE_WORDS = { mein: 'men' };

/**
 * Fixed phrases people type in many ways on a phone (D23 decisions, ROMANIZATION.md §7). When the
 * EXPECTED answer contains `canonical`, a typed variant in the same place counts as close enough
 * (never exact). Variants are compared after the usual folding, so vowel length and doubled
 * letters don't need listing. A variant only ever stands in for its own phrase.
 */
const PHONE_PHRASES = [
  {
    canonical: 'assalaam o alaikum',
    variants: ['assalamualaikum', 'assalamu alaikum', 'assalam alaikum', 'asalamualaikum', 'aslamualaikum', 'aslam o alaikum', 'salam alaikum', 'salamualaikum', 'salam'],
  },
  {
    canonical: 'wa alaikum assalaam',
    variants: ['walaikum assalam', 'walaikumassalam', 'walaikum salam', 'wa alaikum salam', 'waalaikum assalam', 'walekum assalam'],
  },
  { canonical: 'alhamdulillaah', variants: ['alhamdu lillah', 'alhamdolillah', 'alhumdulillah', 'alhamdulilah'] },
  // Lesson 5: yes / no / no idea, as they're texted (`g` is the usual texting spelling of jii).
  { canonical: 'pataa nahiiN', variants: ['pta nhi', 'pata nhi', 'pta nahi', 'pta nai', 'pata nai'] },
  { canonical: 'nahiiN', variants: ['nhi', 'nai', 'nahee'] },
  { canonical: 'jii', variants: ['g'] },
  { canonical: 'taiyaar', variants: ['tayyar', 'tayar', 'tyar', 'tayaar'] },
];

/** Lowercase-free tokenisation shared by every comparison: hyphen = space, punctuation removed. */
export function tokens(s) {
  return String(s ?? '')
    .replace(/-/g, ' ')
    .replace(PUNCT, '')
    .split(/\s+/)
    .filter(Boolean);
}

/** The exact comparison form: tokens joined by single spaces, case preserved. */
export function exactForm(s) {
  return tokens(s).join(' ');
}

export function exact(a, b) {
  return exactForm(a) === exactForm(b);
}

function foldToken(lower, dropFinalNasal) {
  let t = lower;
  if (dropFinalNasal && Object.hasOwn(PHONE_WORDS, t)) t = PHONE_WORDS[t];
  if (dropFinalNasal) t = t.replace(/([aeiou])n$/, '$1');
  return t
    .replace(/ee/g, 'ii')
    .replace(/oo/g, 'uu')
    .replace(/v/g, 'w')
    .replace(/aa+/g, 'a')
    .replace(/ii+/g, 'i')
    .replace(/uu+/g, 'u')
    .replace(/([^aeiou])\1+/g, '$1');
}

/**
 * The lenient key of an EXPECTED (schema-spelt) word: a final capital N is the nasal marker
 * and is dropped. A plain final `n` is a real consonant (din, jaan) and is kept.
 */
export function lenientKey(expectedWord) {
  return foldToken(expectedWord.toLowerCase(), /N$/.test(expectedWord));
}

/**
 * Lenient keys a TYPED word may have, given the expected word. Only an expected nasal `N` makes the
 * final n/N optional (hun, hu, huuN all match huuN). When the expected word has no N, a final
 * n is a consonant: an extra or missing one is a mismatch (din ≠ dii, jaan ≠ jaa).
 */
function typedKeys(word, expectedHasNasal) {
  const lower = word.toLowerCase();
  if (!expectedHasNasal) return new Set([foldToken(lower, false)]);
  return new Set([foldToken(lower, false), foldToken(lower, true)]);
}

/** Compare one token. Loanwords are matched case-insensitively and nothing else. */
function compareToken(typed, expected, loanwords) {
  if (typed === expected) return 'exact';
  if (loanwords?.has(expected.toLowerCase())) return typed.toLowerCase() === expected.toLowerCase() ? 'close' : 'wrong';
  return typedKeys(typed, /N$/.test(expected)).has(lenientKey(expected)) ? 'close' : 'wrong';
}

/**
 * Compare a typed answer to ONE expected answer.
 * @param {string} typed
 * @param {string} expected
 * @param {{ loanwords?: Set<string> }} [opts]  lowercase loanword spellings that appear in `expected`
 * @returns {'exact'|'close'|'wrong'}
 */
export function compare(typed, expected, { loanwords } = {}) {
  const b = tokens(expected);
  const { list: a, aliased } = rewritePhonePhrases(tokens(typed), b);
  if (a.length === 0 || a.length !== b.length) return 'wrong';
  let result = 'exact';
  for (let i = 0; i < a.length; i++) {
    const r = compareToken(a[i], b[i], loanwords);
    if (r === 'wrong') return 'wrong';
    if (r === 'close') result = 'close';
  }
  return aliased && result === 'exact' ? 'close' : result;
}

const foldKey = (t) => foldToken(t.toLowerCase(), false);
const foldSeq = (s) => tokens(s).map(foldKey);
const PHRASES_FOLDED = PHONE_PHRASES.map((p) => ({ canonical: tokens(p.canonical), key: foldSeq(p.canonical), variants: p.variants.map(foldSeq).sort((x, y) => y.length - x.length) }));
const startsAt = (list, i, seq) => seq.length > 0 && seq.every((k, j) => list[i + j] !== undefined && foldKey(list[i + j]) === k);

/**
 * Replace typed phone spellings of fixed phrases with the expected tokens, but only for phrases the
 * expected answer actually contains. Returns the new token list and whether anything was replaced.
 */
function rewritePhonePhrases(typed, expected) {
  const wanted = PHRASES_FOLDED.filter((p) => expected.some((_, i) => startsAt(expected, i, p.key)));
  if (!wanted.length) return { list: typed, aliased: false };
  // Longest variants first, so "walaikum assalam" wins over "walaikum".
  const candidates = wanted.flatMap((p) => p.variants.map((v) => ({ p, v }))).sort((x, y) => y.v.length - x.v.length);
  const out = [];
  let aliased = false;
  for (let i = 0; i < typed.length; ) {
    // Already the scheme's spelling (perhaps leniently): leave it to the normal comparison.
    const canonicalHere = wanted.find((p) => startsAt(typed, i, p.key));
    const hit = canonicalHere ? null : candidates.find(({ v }) => startsAt(typed, i, v));
    if (canonicalHere) {
      out.push(...typed.slice(i, i + canonicalHere.key.length));
      i += canonicalHere.key.length;
    } else if (hit) {
      const at = expected.findIndex((_, k) => startsAt(expected, k, hit.p.key));
      out.push(...expected.slice(at, at + hit.p.canonical.length));
      i += hit.v.length;
      aliased = true;
    } else out.push(typed[i++]);
  }
  return { list: out, aliased };
}

/**
 * Character diff of the expected form against what was typed: segments of the EXPECTED string,
 * `same: false` where the typed text differs (longest common subsequence, case-sensitive).
 * @returns {{ text: string, same: boolean }[]}
 */
export function diffAgainst(typed, expected) {
  const a = exactForm(typed);
  const b = exactForm(expected);
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const same = new Array(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      same[j] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const out = [];
  for (let k = 0; k < m; k++) {
    const last = out[out.length - 1];
    if (last && last.same === same[k]) last.text += b[k];
    else out.push({ text: b[k], same: same[k] });
  }
  return out;
}

/** Edit distance, used only to pick which of several answers to show a wrong typer. */
function distance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Check a typed answer against every acceptable answer (alternative phrasings, word orders).
 * @param {string} typed
 * @param {string[]} answers  Roman answers
 * @param {{ loanwords?: Set<string> }} [opts]
 * @returns {{ result: 'exact'|'close'|'wrong', answer: string|null, diff: {text:string,same:boolean}[] }}
 *   `answer` is the matching answer (the closest one when wrong); `diff` is relative to it.
 */
export function check(typed, answers, opts = {}) {
  const list = answers.filter(Boolean);
  if (list.length === 0 || tokens(typed).length === 0) return { result: 'wrong', answer: list[0] ?? null, diff: [] };
  let close = null;
  for (const answer of list) {
    const r = compare(typed, answer, opts);
    if (r === 'exact') return { result: 'exact', answer, diff: diffAgainst(typed, answer) };
    if (r === 'close' && close === null) close = answer;
  }
  if (close !== null) return { result: 'close', answer: close, diff: diffAgainst(typed, close) };
  const t = exactForm(typed);
  const nearest = list.reduce((best, a) => (distance(t, exactForm(a)) < distance(t, exactForm(best)) ? a : best), list[0]);
  return { result: 'wrong', answer: nearest, diff: diffAgainst(typed, nearest) };
}

/** True for exact and close. */
export const isCorrect = (result) => result === 'exact' || result === 'close';
