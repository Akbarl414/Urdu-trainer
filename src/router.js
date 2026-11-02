// Minimal hash router. Routes map a hash path to a lazy-loaded screen module.
// A screen module exports `render(container)` and may return a cleanup function.

const routes = {
  '': () => import('./modules/home.js'),
  '/debug/voices': () => import('./modules/debug/voices.js'),
};

export function startRouter(container) {
  let cleanup = null;
  let token = 0;

  async function show() {
    const path = window.location.hash.replace(/^#/, '') || '';
    const load = routes[path] ?? routes[''];
    const mine = ++token;
    const mod = await load();
    if (mine !== token) return; // a newer navigation won
    cleanup?.();
    container.replaceChildren();
    cleanup = mod.render(container) || null;
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', show);
  return show();
}
