// Step 2: grammar. One small idea per screen, with an example table or example sentences.
import { h } from '../../../ui/dom.js';
import { urduLine } from '../../../ui/urduText.js';
import { prose, para } from '../../../ui/prose.js';

function table({ headers, rows }) {
  const cols = `repeat(${headers.length}, minmax(0, 1fr))`;
  return h(
    'div',
    { class: 'gtable', role: 'table' },
    h('div', { class: 'gtable-head', role: 'row', style: `grid-template-columns:${cols}` }, headers.map((t) => h('div', { role: 'columnheader' }, t))),
    rows.map((row) =>
      h(
        'div',
        { class: 'gtable-row', role: 'row', style: `grid-template-columns:${cols}` },
        row.map((cell, i) =>
          h(
            'div',
            { class: 'gtable-cell', role: 'cell', 'data-label': headers[i] },
            typeof cell === 'string' ? h('span', {}, ...prose(cell)) : [urduLine(cell), h('span', { class: 'muted ex-en' }, cell.en)],
          ),
        ),
      ),
    ),
  );
}

export function mountGrammar(ctx) {
  const g = ctx.lesson.grammar[ctx.run.index];
  const last = ctx.run.index === ctx.lesson.grammar.length - 1;
  ctx.body.append(
    h(
      'section',
      { class: 'card grammar' },
      h('h2', {}, ...prose(g.heading)),
      para(g.body),
      g.table ? table(g.table) : null,
      g.examples ? h('div', { class: 'examples' }, g.examples.map((e) => h('div', { class: 'example' }, urduLine(e), h('span', { class: 'muted ex-en' }, e.en)))) : null,
    ),
  );
  ctx.setActions(h('button', { class: 'btn', type: 'button', onclick: () => ctx.complete((run) => run) }, last ? 'Got it — on to the words' : 'Got it'));
}
