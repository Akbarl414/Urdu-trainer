// #/debug/themes — every component in the three looks side by side (PLAN D26). Reads and writes nothing in storage.
// Each panel carries its own data-theme / data-mode, so it uses exactly the tokens and decorative CSS the real screens do.
// The page itself drops the root theme (decorative CSS is scoped by descendant selectors, so nesting two looks would mix them).
import { h } from '../../ui/dom.js';
import { urduText } from '../../ui/urduText.js';
import { THEMES, reapplyTheme } from '../../ui/theme.js';

const SALAAM = { roman: 'assalaam-o-alaikum', ur: 'السلام علیکم', en: 'Peace be upon you' };
const THANKS = { roman: 'bahut shukriyaa', ur: 'بہت شکریہ' };
const sysDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

function sample(theme, mode) {
  const choice = (cls, en, disabled = cls !== '') => h('button', { class: `btn btn-secondary choice ${cls}`, type: 'button', disabled }, urduText(THANKS), en ? h('span', { class: 'choice-en' }, en) : null);
  return h(
    'section',
    { class: 'panel', 'data-theme': theme.id, 'data-mode': mode },
    h('div', { class: 'page' },
      h('h1', {}, theme.name),
      h('p', { class: 'progress-line' }, 'Lesson 3 · Unit 1 · 12 due · 🔥 4 days'),

      h('section', { class: 'card primary' },
        h('p', { class: 'lesson-title' }, 'Lesson 3: Being polite'),
        h('p', { class: 'muted' }, 'You can greet someone and thank them.'),
        h('p', { class: 'muted small' }, 'About 8 minutes'),
        h('a', { class: 'btn btn-big', href: '#' }, 'Start today’s lesson')),

      h('section', { class: 'card' },
        h('h2', {}, 'Buttons'),
        h('div', { class: 'stack' },
          h('button', { class: 'btn', type: 'button' }, 'Primary'),
          h('button', { class: 'btn btn-secondary', type: 'button' }, 'Secondary'),
          h('button', { class: 'btn btn-danger', type: 'button' }, 'Danger'),
          h('button', { class: 'btn', type: 'button', disabled: true }, 'Disabled')),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-small', type: 'button' }, 'Small'),
          h('div', { class: 'segmented' }, h('button', { class: 'seg on', type: 'button' }, 'Type'), h('button', { class: 'seg', type: 'button' }, 'Speak')),
          h('button', { class: 'audio-btn', type: 'button', 'aria-label': 'Listen' }, '🔊'),
          h('button', { class: 'script-toggle', type: 'button', 'aria-pressed': 'true' }, h('span', { lang: 'ur' }, 'اردو')),
          h('span', { class: 'chip' }, 'new'))),

      h('section', { class: 'card' },
        h('h2', {}, 'Progress'),
        ...[0.3, 0.7, 1].map((p) => h('div', { class: 'bar', style: 'margin:10px 0' }, h('span', { class: 'bar-fill', style: `width:${p * 100}%` })))),

      h('section', { class: 'card' },
        h('h2', {}, 'Urdu text'),
        h('p', { class: 'center' }, urduText(SALAAM, { big: true })),
        h('p', { class: 'center muted' }, SALAAM.en),
        h('p', {}, 'Mix: ', h('span', { class: 'rom' }, 'maiN Thiik huuN'), ' and ', h('span', { class: 'weak' }, 'a weak word'), '.')),

      h('section', { class: 'card exercise' },
        h('p', { class: 'ex-label' }, 'Pick the meaning'),
        h('p', { class: 'ex-question' }, 'How do you say “thank you very much”?'),
        h('div', { class: 'stack choices' }, choice('', '', false), choice('is-correct', 'thank you very much'), choice('is-wrong', 'good morning'), choice('', 'please', true)),
        h('p', { class: 'hint' }, 'Hint: it starts with a b.'),
        h('p', { class: 'feedback good' }, '✓ Correct'),
        h('p', { class: 'feedback bad' }, '✗ Not quite: bahut shukriyaa'),
        h('input', { class: 'field', type: 'text', placeholder: 'Type in Roman Urdu', 'aria-label': 'Answer' })),

      h('section', { class: 'card' },
        h('h2', {}, 'Word order'),
        h('div', { class: 'tile-line' }, h('button', { class: 'btn-secondary tile-btn', type: 'button' }, 'maiN'), h('button', { class: 'btn-secondary tile-btn', type: 'button' }, 'Thiik')),
        h('div', { class: 'tile-line is-correct' }, h('span', { class: 'tile' }, 'maiN'), h('span', { class: 'tile' }, 'huuN')),
        h('div', { class: 'tile-line is-wrong' }, h('span', { class: 'tile' }, 'huuN'), h('span', { class: 'tile' }, 'maiN')),
        h('p', { class: 'diff' }, 'You typed: maiN ', h('mark', {}, 'Thek'), ' huuN')),

      h('section', { class: 'card' },
        h('h2', {}, 'Review grades'),
        h('div', { class: 'grades' },
          ...[['again', 'Again', '1m'], ['hard', 'Hard', '6m'], ['good', 'Good', '2d'], ['easy', 'Easy', '5d']].map(([k, n, i]) => h('button', { class: `grade grade-${k}${k === 'good' ? ' suggested' : ''}`, type: 'button' }, h('span', { class: 'grade-name' }, n), h('span', { class: 'grade-int' }, i))))),

      h('section', { class: 'card grammar' },
        h('h2', {}, 'Grammar table'),
        h('div', { class: 'gtable' },
          h('div', { class: 'gtable-head', style: 'grid-template-columns:1fr 1fr' }, h('div', {}, 'Person'), h('div', {}, 'To be')),
          h('div', { class: 'gtable-row', style: 'grid-template-columns:1fr 1fr' }, h('div', { class: 'gtable-cell', 'data-label': 'Person' }, 'I'), h('div', { class: 'gtable-cell', 'data-label': 'To be' }, urduText({ roman: 'huuN', ur: 'ہوں' }))),
          h('div', { class: 'gtable-row', style: 'grid-template-columns:1fr 1fr' }, h('div', { class: 'gtable-cell', 'data-label': 'Person' }, 'you'), h('div', { class: 'gtable-cell', 'data-label': 'To be' }, urduText({ roman: 'ho', ur: 'ہو' }))))),

      h('section', { class: 'card dline mine' }, h('p', { class: 'speaker' }, 'You'), urduText(SALAAM)),
      h('section', { class: 'card ok' }, h('strong', {}, 'Done'), ' · card with a good border'),
      h('section', { class: 'card warn' }, h('strong', {}, 'Careful'), ' · card with a warning border'),
      h('section', { class: 'card ask' }, h('strong', {}, 'One quick question'), ' · highlighted card'),
      h('section', { class: 'card primary done' }, h('p', { class: 'lesson-title' }, '✓ Today’s lesson is done'), h('p', { class: 'muted' }, 'Lesson 4 is scheduled for tomorrow.')),

      h('section', { class: 'card' },
        h('h2', {}, 'Lesson summary'),
        h('div', { class: 'stats' }, ...[['12', 'words'], ['9', 'right'], ['3', 'again'], ['5:40', 'time']].map(([n, l]) => h('div', { class: 'stat' }, h('strong', {}, n), h('span', { class: 'muted small' }, l))))),

      h('div', { class: 'banner banner-info' }, h('span', {}, 'Update available.'), h('button', { class: 'btn btn-small', type: 'button' }, 'Reload')),
      h('div', { class: 'banner banner-warn', style: 'margin-top:8px' }, h('span', {}, 'Storage is full. Export a backup.'), h('button', { class: 'btn btn-small', type: 'button' }, 'Export')),

      h('section', { class: 'card recovery-sample' },
        h('h2', {}, 'Recovery screen'),
        h('p', {}, 'Your saved progress needs attention.'),
        h('p', { class: 'muted small' }, 'Technical detail: unexpected token'),
        h('div', { class: 'stack' }, h('button', { class: 'btn', type: 'button' }, 'Download raw data'), h('button', { class: 'btn btn-secondary', type: 'button' }, 'Import a backup file'), h('button', { class: 'btn btn-danger', type: 'button' }, 'Start fresh'))),

      h('p', { class: 'muted small build' }, 'Build · footer text'),
    ),
  );
}

export function render(container) {
  const root = document.documentElement;
  const had = { theme: root.dataset.theme, mode: root.dataset.mode };
  delete root.dataset.theme;
  delete root.dataset.mode;
  root.classList.add('debug-themes');
  let mode = sysDark ? 'dark' : 'light';

  const grid = h('div', { class: 'theme-grid' });
  const modeButtons = ['light', 'dark'].map((m) => h('button', { class: 'seg', type: 'button', onclick: () => ((mode = m), draw()) }, m === 'light' ? 'Light' : 'Dark'));
  function draw() {
    modeButtons.forEach((b, i) => {
      const on = ['light', 'dark'][i] === mode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    grid.replaceChildren(...THEMES.map((t) => sample(t, mode)));
  }
  draw();

  container.append(
    h('main', { class: 'debug-head' },
      h('a', { href: '#', class: 'back' }, '‹ Back'),
      h('h1', {}, 'Themes side by side'),
      h('p', { class: 'muted' }, 'Every component in each look. Nothing here is saved.'),
      h('div', { class: 'segmented' }, modeButtons)),
    grid,
  );
  return () => {
    root.classList.remove('debug-themes');
    if (had.theme) root.dataset.theme = had.theme;
    if (had.mode) root.dataset.mode = had.mode;
    reapplyTheme();
  };
}
