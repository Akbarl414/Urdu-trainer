// Roman Urdu → Devanagari, used ONLY as a spoken-audio fallback (PLAN D13): when a
// device has no Urdu voice but has a Hindi one, we feed the Hindi voice this text.
// The output is never shown as learning content and is never stored.
//
// Deterministic and purely a function of the romanization scheme in
// content/ROMANIZATION.md. Faithful to the roman, not to Hindi spelling: a consonant
// directly followed by another consonant gets a halant (kamraa → कम्रा), because the
// roman has no vowel there. Word-final consonants get no halant (Hindi voices drop the
// final schwa). Tokens in `loanwords`, and anything that is not roman letters, pass
// through unchanged.

const NUKTA = '़';
const HALANT = '्';
const CHANDRABINDU = 'ँ';
const ANUSVARA = 'ं';

// Longest match first.
const CONSONANTS = [
  ['cch', null], // handled specially (see below)
  ['chh', 'छ'],
  ['kh', 'ख'], ['gh', 'घ'], ['ch', 'च'], ['jh', 'झ'],
  ['Th', 'ठ'], ['Dh', 'ढ'], ['Rh', 'ढ' + NUKTA],
  ['th', 'थ'], ['dh', 'ध'], ['ph', 'फ'], ['bh', 'भ'], ['sh', 'श'], ['zh', 'ज' + NUKTA],
  ['Gh', 'ग' + NUKTA],
  ['k', 'क'], ['g', 'ग'], ['c', 'च'], ['j', 'ज'],
  ['T', 'ट'], ['D', 'ड'], ['R', 'ड' + NUKTA],
  ['t', 'त'], ['d', 'द'], ['n', 'न'], ['p', 'प'], ['b', 'ब'], ['m', 'म'],
  ['y', 'य'], ['r', 'र'], ['l', 'ल'], ['w', 'व'], ['v', 'व'], ['s', 'स'], ['h', 'ह'],
  ['x', 'ख' + NUKTA], ['q', 'क' + NUKTA], ['z', 'ज' + NUKTA], ['f', 'फ' + NUKTA],
];
const VOWELS = [
  ['aa', 'आ', 'ा'], ['ii', 'ई', 'ी'], ['uu', 'ऊ', 'ू'], ['ai', 'ऐ', 'ै'], ['au', 'औ', 'ौ'],
  ['a', 'अ', ''], ['i', 'इ', 'ि'], ['u', 'उ', 'ु'], ['e', 'ए', 'े'], ['o', 'ओ', 'ो'],
];
// Vowel signs that sit above the headline take an anusvara; the rest take a chandrabindu.
const TAKES_ANUSVARA = new Set(['ai', 'ii', 'i', 'e', 'o', 'au']);

function matchAt(table, word, i) {
  for (const row of table) if (word.startsWith(row[0], i)) return row;
  return null;
}

/** One roman word (no spaces or punctuation) → Devanagari. */
export function wordToDevanagari(word) {
  const cchAsChh = word.startsWith('acch'); // acchaa is अच्छा; every other cch is च्च (bacchaa)
  let out = '';
  let prev = null; // 'C' consonant, 'V' vowel, null at start
  let prevVowel = null; // the vowel key just written
  let i = 0;
  while (i < word.length) {
    const v = matchAt(VOWELS, word, i);
    if (v) {
      out += prev === 'C' ? v[2] : v[1];
      prev = 'V';
      prevVowel = v[0];
      i += v[0].length;
      continue;
    }
    const c = matchAt(CONSONANTS, word, i);
    if (!c) return null; // not roman Urdu
    let [key, glyph] = c;
    if (key === 'cch') {
      glyph = cchAsChh ? 'च' + HALANT + 'छ' : 'च' + HALANT + 'च';
      prev = 'C';
      out += glyph;
      i += 3;
      continue;
    }
    // Inside-word nasal: a vowel + n + another consonant is a nasalised vowel (aankh, paanch, munh).
    if (key === 'n' && prev === 'V') {
      const rest = matchAt(CONSONANTS, word, i + 1);
      if (rest && !['n', 'm'].includes(rest[0])) {
        out += ANUSVARA;
        i += 1;
        continue;
      }
    }
    if (prev === 'C') out += HALANT;
    out += glyph;
    prev = 'C';
    i += key.length;
  }
  return out;
}

function nasalMark(vowelKey) {
  return TAKES_ANUSVARA.has(vowelKey) ? ANUSVARA : CHANDRABINDU;
}

/**
 * Convert one word, handling the word-final `N`. Returns null if the word isn't roman Urdu.
 */
function convertWord(word) {
  let body = word;
  let nasal = false;
  if (/[aeiou]N$/.test(word)) {
    body = word.slice(0, -1);
    nasal = true;
  }
  const dev = wordToDevanagari(body);
  if (dev == null) return null;
  if (!nasal) return dev;
  // Which vowel came last? Re-scan the tail of the roman body.
  const tail = ['aa', 'ii', 'uu', 'ai', 'au'].find((k) => body.endsWith(k)) ?? body.slice(-1);
  return dev + nasalMark(tail);
}

/**
 * Roman Urdu text → Devanagari.
 * @param {string} text
 * @param {{ loanwords?: Iterable<string> }} [opts] lowercase tokens to leave untouched
 */
export function romanToDevanagari(text, { loanwords = [] } = {}) {
  const skip = new Set([...loanwords].map((w) => w.toLowerCase()));
  return text.replace(/[A-Za-z]+/g, (token) => {
    if (skip.has(token.toLowerCase())) return token;
    return convertWord(token) ?? token;
  });
}

/** True when the text contains tokens that were not converted (loanwords, typos). */
export function unconvertedTokens(text, opts = {}) {
  const skip = new Set([...(opts.loanwords ?? [])].map((w) => w.toLowerCase()));
  return (text.match(/[A-Za-z]+/g) ?? []).filter((t) => skip.has(t.toLowerCase()) || convertWord(t) == null);
}
