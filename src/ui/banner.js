import { h } from './dom.js';

const live = new Map();

/**
 * Show (or replace) a banner at the top of the page.
 * @param {{ id: string, text: string, actionLabel?: string, onAction?: () => void, tone?: 'info'|'warn' }} opts
 * @returns {() => void} dismiss
 */
export function showBanner({ id, text, actionLabel, onAction, tone = 'info' }) {
  hideBanner(id);
  const el = h(
    'div',
    { class: `banner banner-${tone}`, role: 'status' },
    h('span', {}, text),
    actionLabel ? h('button', { class: 'btn btn-small', onclick: onAction }, actionLabel) : null,
  );
  document.getElementById('banners')?.append(el);
  live.set(id, el);
  return () => hideBanner(id);
}

export function hideBanner(id) {
  live.get(id)?.remove();
  live.delete(id);
}
