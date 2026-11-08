// WCAG AA for text in every theme variant (PLAN D27). Reads src/ui/styles/tokens.css directly, so a palette
// edit that breaks contrast fails the build. Decorative colours (deco-*) are deliberately not checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/ui/styles/tokens.css'), 'utf8');

export const THEMES = ['truck-art', 'jewel', 'neon'];
export const MODES = ['light', 'dark'];

function variantTokens(theme, mode) {
  const re = new RegExp(`\\[data-theme='${theme}'\\]\\[data-mode='${mode}'\\]\\s*\\{([^}]*)\\}`);
  const m = re.exec(css);
  assert.ok(m, `no token block for ${theme} ${mode}`);
  const out = {};
  for (const [, k, v] of m[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[k] = v;
  return out;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** `color-mix(in srgb, fg pct%, bg)`: what the CSS tints (chips, table heads, hints, correct/wrong choices) look like. */
function mix(fg, pct, bg) {
  const a = rgb(fg);
  const b = rgb(bg);
  return '#' + a.map((c, i) => Math.round(c * pct + b[i] * (1 - pct)).toString(16).padStart(2, '0')).join('');
}

const REQUIRED = ['paper', 'surface', 'ink', 'ink-muted', 'line', 'edge', 'primary', 'primary-ink', 'accent', 'accent-ink', 'accent-text', 'good', 'bad', 'bad-ink', 'deco-1', 'deco-2', 'deco-3', 'focus', 'btn-edge', 'game-right', 'game-right-ink', 'game-wrong', 'game-wrong-ink'];

for (const theme of THEMES) {
  for (const mode of MODES) {
    test(`${theme} ${mode}: defines every colour token`, () => {
      const t = variantTokens(theme, mode);
      for (const k of REQUIRED) assert.ok(t[k], `missing --${k}`);
    });

    test(`${theme} ${mode}: text meets WCAG AA (4.5:1)`, () => {
      const t = variantTokens(theme, mode);
      const pairs = [
        // body text on every background it appears on
        ['ink on paper', t.ink, t.paper],
        ['ink on surface', t.ink, t.surface],
        ['ink-muted on paper', t['ink-muted'], t.paper],
        ['ink-muted on surface', t['ink-muted'], t.surface],
        // tints used behind text
        ['ink on primary tint (table head, active audio)', t.ink, mix(t.primary, 0.18, t.surface)],
        ['ink on good tint (correct answer)', t.ink, mix(t.good, 0.14, t.surface)],
        ['ink on bad tint (wrong answer)', t.ink, mix(t.bad, 0.25, t.surface)],
        ['ink on accent tint (hint)', t.ink, mix(t.accent, 0.14, t.paper)],
        ['ink on good tint over paper (voice)', t.ink, mix(t.good, 0.12, t.paper)],
        // links, chips and secondary buttons are primary-coloured text
        ['primary on paper (links)', t.primary, t.paper],
        ['primary on surface (secondary buttons)', t.primary, t.surface],
        ['primary on its tint (chip)', t.primary, mix(t.primary, 0.12, t.paper)],
        ['primary on surface tint (selected grade)', t.primary, mix(t.primary, 0.08, t.surface)],
        // filled controls
        ['primary-ink on primary (buttons, selected segment)', t['primary-ink'], t.primary],
        ['accent-ink on accent (warning banner)', t['accent-ink'], t.accent],
        ['bad-ink on bad (danger and record buttons)', t['bad-ink'], t.bad],
        ['ink on paper over the banner button', t.ink, t.paper],
        ['game-right-ink on game-right (right answer buttons)', t['game-right-ink'], t['game-right']],
        ['game-wrong-ink on game-wrong (wrong answer buttons)', t['game-wrong-ink'], t['game-wrong']],
        ['ink on timer bar track (line)', t.ink, t.line],
        // feedback and emphasis colours used as text
        ['good on paper', t.good, t.paper],
        ['good on surface', t.good, t.surface],
        ['bad on paper', t.bad, t.paper],
        ['bad on surface', t.bad, t.surface],
        ['accent-text on paper (weak words)', t['accent-text'], t.paper],
        ['accent-text on surface', t['accent-text'], t.surface],
      ];
      const fails = pairs.filter(([, a, b]) => contrast(a, b) < 4.5).map(([name, a, b]) => `${name}: ${a} on ${b} = ${contrast(a, b).toFixed(2)}`);
      assert.deepEqual(fails, []);
    });

    test(`${theme} ${mode}: borders and focus rings meet 3:1 where they carry meaning`, () => {
      const t = variantTokens(theme, mode);
      const pairs = [
        ['focus on paper', t.focus, t.paper],
        ['focus on surface', t.focus, t.surface],
        ['good border on surface', t.good, t.surface],
        ['bad border on surface', t.bad, t.surface],
        ['primary on paper (button outline)', t.primary, t.paper],
      ];
      const fails = pairs.filter(([, a, b]) => contrast(a, b) < 3).map(([name, a, b]) => `${name}: ${contrast(a, b).toFixed(2)}`);
      assert.deepEqual(fails, []);
    });
  }
}
