// The "Show Urdu script" switch (BRIEF §5.6). Applies instantly through a class on <html>; the preference
// lives in settings.showScript. Settings (Phase 5) will offer the same switch.
import { h } from './dom.js';
import { store } from '../db/storage.js';

export function applyScriptSetting(on = store.data.settings.showScript) {
  document.documentElement.classList.toggle('show-script', !!on);
}

export function scriptToggle() {
  const btn = h('button', { class: 'script-toggle', type: 'button', title: 'Show Urdu script' }, h('span', { lang: 'ur', 'aria-hidden': 'true' }, 'اردو'), h('span', { class: 'sr' }, 'Show Urdu script'));
  const draw = () => btn.setAttribute('aria-pressed', store.data.settings.showScript ? 'true' : 'false');
  btn.addEventListener('click', () => {
    const on = !store.data.settings.showScript;
    store.updateSettings({ showScript: on });
    applyScriptSetting(on);
    draw();
  });
  draw();
  return btn;
}
