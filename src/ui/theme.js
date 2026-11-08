// Themes (PLAN D26): the look (settings.theme) and the colour mode (settings.themeMode) become two attributes on <html>.
// All the styling is in src/ui/styles/tokens.css + themes.css; this file only picks the variant and offers the switcher.
import { h } from './dom.js';
import { store } from '../db/storage.js';

export const THEMES = [
  { id: 'truck-art', name: 'Truck Art', blurb: 'Bold and joyful' },
  { id: 'jewel', name: 'Jewel', blurb: 'Rich and elegant' },
  { id: 'neon', name: 'Neon Pop', blurb: 'Modern and punchy' },
];
export const MODES = [
  { id: 'system', name: 'Auto' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
];
export const DEFAULT_THEME = 'truck-art';

const dark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

export const themeId = (settings = store.data.settings) => (THEMES.some((t) => t.id === settings.theme) ? settings.theme : DEFAULT_THEME);
export const modeId = (settings = store.data.settings) => (MODES.some((m) => m.id === settings.themeMode) ? settings.themeMode : 'system');
export const resolveMode = (mode) => (mode === 'light' || mode === 'dark' ? mode : dark?.matches ? 'dark' : 'light');

/** Sets data-theme / data-mode on <html> and the browser's address-bar colour. Call at boot and after any change. */
export function applyTheme(settings = store.data.settings) {
  const root = document.documentElement;
  root.dataset.theme = themeId(settings);
  root.dataset.mode = resolveMode(modeId(settings));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--paper').trim() || '#fff6dc');
}

// "Auto" follows the phone live.
dark?.addEventListener?.('change', () => {
  if (store.status().mode !== 'recovery' && modeId() === 'system') applyTheme();
});

/** The prominent switcher on Today: three look cards (each drawn in its own colours) and Auto / Light / Dark. */
export function themeSwitcher() {
  const root = h('section', { class: 'card theme-switcher' });
  function draw() {
    const cur = themeId();
    const mode = modeId();
    const shown = resolveMode(mode);
    const pick = (patch) => {
      store.updateSettings(patch);
      applyTheme();
      draw();
    };
    root.replaceChildren(
      h('h2', {}, 'Choose a look'),
      h(
        'div',
        { class: 'swatches', role: 'group', 'aria-label': 'Look' },
        THEMES.map((t) =>
          h(
            'button',
            { class: 'swatch', type: 'button', 'data-theme': t.id, 'data-mode': shown, 'aria-pressed': t.id === cur ? 'true' : 'false', onclick: () => pick({ theme: t.id }) },
            h('span', { class: 'swatch-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
            h('span', { class: 'swatch-name' }, t.name),
            h('span', { class: 'swatch-blurb' }, t.blurb),
          ),
        ),
      ),
      h(
        'div',
        { class: 'row' },
        h('span', {}, 'Colours'),
        h('div', { class: 'segmented', role: 'group', 'aria-label': 'Light or dark' }, MODES.map((m) => h('button', { class: `seg${m.id === mode ? ' on' : ''}`, type: 'button', 'aria-pressed': m.id === mode ? 'true' : 'false', onclick: () => pick({ themeMode: m.id }) }, m.name))),
      ),
      h('p', { class: 'muted small' }, 'Try each one on a lesson and a review, then keep the one you like. ', h('a', { href: '#/debug/themes' }, 'See every component side by side')),
    );
  }
  draw();
  return root;
}

/** Re-applies the saved variant (or the defaults when storage is blocked, as on the recovery screen). */
export function reapplyTheme() {
  applyTheme(store.status().mode === 'recovery' ? { theme: DEFAULT_THEME, themeMode: 'system' } : store.data.settings);
}
