// Is a typed English meaning right? (Listen & type, "type the meaning".) Pure.
//
// meaning_en fields look like `house, home`, `how are you? (polite)`, `to go`. A typed answer is right when it equals ONE of
// the listed meanings after tidying (lower case, punctuation and brackets dropped, a leading "to " optional), or is one
// letter off a meaning of 5+ letters (a typo). The whole meaning typed in full is fine too.

const strip = (s) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // (polite), (informal)
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const dropTo = (s) => s.replace(/^to /, '');

/** The meanings a learner could reasonably type for a word's `meaning_en`. */
export function acceptedMeanings(meaningEn) {
  const whole = strip(meaningEn);
  const parts = meaningEn
    .replace(/\([^)]*\)/g, ' ')
    .split(/[,;/]| or /i)
    .map(strip)
    .filter(Boolean);
  const out = new Set();
  for (const m of [whole, ...parts]) {
    out.add(m);
    out.add(dropTo(m));
  }
  out.delete('');
  return [...out];
}

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

/** @returns {boolean} */
export function isMeaningRight(typed, meaningEn) {
  const t = dropTo(strip(typed));
  if (!t) return false;
  return acceptedMeanings(meaningEn).some((m) => m === t || (m.length >= 5 && t.length >= 5 && distance(m, t) <= 1));
}
