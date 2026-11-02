// A list of answer options. English that belongs to an option stays hidden until the learner has answered.
import { h } from '../../ui/dom.js';
import { urduText } from '../../ui/urduText.js';

/**
 * @param {{ text?: string, roman?: string, ur?: string, en?: string }[]} options  see choiceOptions() in src/lesson/exercises.js
 * @param {(index: number) => void} onPick
 */
export function choiceList(options, onPick) {
  let locked = false;
  const buttons = options.map((o, i) =>
    h(
      'button',
      { class: 'btn btn-secondary choice', type: 'button', onclick: () => !locked && ((locked = true), onPick(i)) },
      o.text != null ? h('span', { class: 'choice-text' }, o.text) : urduText(o),
    ),
  );
  return {
    el: h('div', { class: 'stack choices' }, buttons),
    /** Mark the right and the chosen options and show each option's English. */
    reveal(correctIndex, pickedIndex) {
      locked = true;
      buttons.forEach((b, i) => {
        b.disabled = true;
        b.classList.toggle('is-correct', i === correctIndex);
        b.classList.toggle('is-wrong', i === pickedIndex && i !== correctIndex);
        if (options[i].en) b.append(h('span', { class: 'choice-en' }, options[i].en));
      });
    },
  };
}
