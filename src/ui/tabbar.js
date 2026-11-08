// The bottom tab bar (BRIEF §5, PLAN §7): Today · Review · Games · Learn · Settings. One bar for the whole app, outside the
// routed screen. It hides itself where a screen needs the whole height (the lesson player, a game round).
import { h } from './dom.js';

const TABS = [
  { id: 'today', label: 'Today', icon: '◆', href: '#/', match: (p) => p === '' || p === '/' },
  { id: 'review', label: 'Review', icon: '↻', href: '#/review', match: (p) => p === '/review' },
  { id: 'games', label: 'Games', icon: '★', href: '#/games', match: (p) => p === '/games' || p === '/stats' },
  { id: 'learn', label: 'Learn', icon: '☰', href: '#/learn', match: (p) => p.startsWith('/learn') },
  { id: 'settings', label: 'Settings', icon: '⚙', href: '#/settings', match: (p) => p === '/settings' },
];

/** Screens that take the whole screen: no tab bar there. */
export const isImmersive = (path) => path.startsWith('/lesson') || path.startsWith('/practice/') || /^\/games\/[a-z-]+$/.test(path);

export function mountTabBar(parent = document.body) {
  const nav = h('nav', { class: 'tabbar', 'aria-label': 'Main' }, TABS.map((t) => h('a', { class: 'tab', href: t.href, 'data-tab': t.id }, h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, t.icon), h('span', { class: 'tab-label' }, t.label))));
  parent.append(nav);
  const sync = () => {
    const path = window.location.hash.replace(/^#/, '');
    const hidden = isImmersive(path) || path.startsWith('/debug/');
    nav.hidden = hidden;
    document.body.classList.toggle('has-tabbar', !hidden);
    for (const a of nav.querySelectorAll('.tab')) {
      const on = TABS.find((t) => t.id === a.dataset.tab).match(path);
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
  };
  window.addEventListener('hashchange', sync);
  sync();
}
