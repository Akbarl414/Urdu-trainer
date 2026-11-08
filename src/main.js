import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/lesson.css';
import './ui/styles/themes.css';
import { store } from './db/storage.js';
import { startRouter } from './router.js';
import { showRecovery } from './ui/recovery.js';
import { showBanner, hideBanner } from './ui/banner.js';
import { registerServiceWorker } from './pwa.js';
import { getContent } from './db/contentLoader.js';
import { syncDeck } from './srs/deck.js';
import { configureMemoryTarget } from './srs/fsrs.js';
import { configureAudio, initAudio } from './audio/tts.js';
import { loanwordTokens } from './lesson/loanwords.js';
import { applyScriptSetting } from './ui/scriptToggle.js';
import { applyTheme, reapplyTheme } from './ui/theme.js';

const app = document.getElementById('app');

function boot() {
  const status = store.status();

  // Storage could not be loaded safely: show the recovery screen and nothing else.
  // (The voice test touches no storage, so it stays reachable.)
  if (status.mode === 'recovery') {
    reapplyTheme(); // storage is blocked: the default look, following the phone's light/dark setting
    if (window.location.hash.startsWith('#/debug/')) startRouter(app);
    else showRecovery(app, store);
    return;
  }

  configureMemoryTarget(() => store.data.settings.memoryTarget);
  applyTheme();
  applyScriptSetting();
  configureAudio({ getSettings: () => store.data.settings, loanwords: loanwordTokens(getContent()) });
  initAudio(); // voices load in the background; screens re-check when they arrive
  if (status.firstRun && navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  store.touchOpened(__BUILD_ID__);
  // Catches content added in a new build: creates any cards completed lessons call for. Additive and idempotent.
  const added = syncDeck(store.data, getContent(), Date.now()).length;
  if (added > 0) store.save();

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
