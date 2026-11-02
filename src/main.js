import './ui/styles/tokens.css';
import './ui/styles/base.css';
import { store } from './db/storage.js';
import { startRouter } from './router.js';
import { showRecovery } from './ui/recovery.js';
import { showBanner, hideBanner } from './ui/banner.js';
import { registerServiceWorker } from './pwa.js';
import { getContent } from './db/contentLoader.js';
import { syncDeck } from './srs/deck.js';
import { removeSeedCards } from './srs/seedCleanup.js';

const app = document.getElementById('app');

function applyTheme() {
  const theme = store.data.settings.theme;
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function boot() {
  const status = store.status();

  // Storage could not be loaded safely: show the recovery screen and nothing else.
  // (The voice test touches no storage, so it stays reachable.)
  if (status.mode === 'recovery') {
    if (window.location.hash.startsWith('#/debug/')) startRouter(app);
    else showRecovery(app, store);
    return;
  }

  applyTheme();
  if (status.firstRun && navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  store.touchOpened(__BUILD_ID__);
  // PLAN D21 (temporary): delete the Phase 2 test cards (`w:seed-…`, `x:seed-lesson:…`) and nothing else.
  const removedSeed = removeSeedCards(store.data);
  // Catches content added in a new build: creates any cards completed lessons call for. Additive and idempotent.
  const added = syncDeck(store.data, getContent(), Date.now()).length;
  if (removedSeed > 0 || added > 0) store.save();

  store.onStatusChange((s) => {
    if (s.quotaFull) showBanner({ id: 'quota', tone: 'warn', text: 'Storage is full: new progress is only kept until you close the app. Export a backup.' });
    else hideBanner('quota');
  });

  startRouter(app);
}

boot();

registerServiceWorker({
  onUpdateReady: (reload) => showBanner({ id: 'update', text: 'Update available.', actionLabel: 'Reload', onAction: reload }),
});
