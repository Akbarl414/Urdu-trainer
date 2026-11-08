// Minimal hash router. Routes map a hash path to a lazy-loaded screen module.
// A screen module exports `render(container)` and may return a cleanup function.

const routes = {
  '': () => import('./modules/today/today.js'),
  '/lesson': () => import('./modules/lesson/player.js'),
  '/lesson/extra': () => import('./modules/lesson/player.js').then((m) => ({ render: m.renderExtra })),
  '/review': () => import('./modules/review/review.js'),
  '/games': () => import('./modules/games/hub.js'),
  '/stats': () => import('./modules/stats/stats.js'),
  '/settings': () => import('./modules/settings/settings.js'),
  '/learn': () => import('./modules/learn/learn.js'),
  '/debug/voices': () => import('./modules/debug/voices.js'),
  '/debug/themes': () => import('./modules/debug/themes.js'),
};

export function startRouter(container) {
  let cleanup = null;
  let token = 0;

  async function show() {
    const path = window.location.hash.replace(/^#/, '') || '';
    // One route takes a parameter: #/practice/<lessonId> (practice-only replay of a completed lesson).
    const practice = /^\/practice\/([a-z0-9-]+)$/.exec(path);
    const game = /^\/games\/([a-z-]+)$/.exec(path);
    const load = game ? () => import('./modules/games/play.js').then((m) => ({ render: (c) => m.renderGame(c, game[1]) })) : practice ? () => import('./modules/lesson/player.js').then((m) => ({ render: (c) => m.renderPractice(c, practice[1]) })) : (routes[path] ?? routes['']);
    const mine = ++token;
    const mod = await load();
    if (mine !== token) return; // a newer navigation won
    cleanup?.();
    container.replaceChildren();
    cleanup = null;
    // A screen may render asynchronously (it returns a promise of its cleanup); if we navigated away meanwhile, clean it up at once.
    Promise.resolve(mod.render(container)).then((fn) => {
      if (typeof fn !== 'function') return;
      if (mine === token) cleanup = fn;
      else fn();
    });
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', show);
  return show();
}
