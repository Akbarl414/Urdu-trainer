// Lowercase tokens of every English loanword in the course (`loanword: true`). The answer checker matches them
// case-insensitively and the Devanagari fallback leaves them unconverted. Pure.
import { tokens } from '../lang/normalise.js';

export function loanwordTokens(content) {
  const out = new Set();
  for (const w of content.words) {
    if (!w.loanword) continue;
    for (const t of [w.roman, ...(w.forms ?? [])].flatMap((s) => tokens(s))) out.add(t.toLowerCase());
  }
  return out;
}
