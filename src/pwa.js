// Service-worker registration and the update flow.
// A new worker installs and waits; we tell the page, the user taps Reload,
// we post SKIP_WAITING, and the page reloads on controllerchange.
// Updating never touches storage.

export function registerServiceWorker({ onUpdateReady }) {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  window.addEventListener('load', async () => {
    let registration;
    try {
      // sw.js sits next to index.html, so this stays inside this repo's path on GitHub Pages.
      registration = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI), {
        scope: new URL('./', document.baseURI).href,
      });
    } catch (e) {
      console.error('Service worker registration failed', e);
      return;
    }

    const announce = (worker) =>
      onUpdateReady(() => {
        // Only reload because the user asked: the very first install also fires controllerchange.
        navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
        worker.postMessage({ type: 'SKIP_WAITING' });
      });

    // A worker already waiting (e.g. the page was reopened) — only an "update" if something is already in control.
    if (registration.waiting && navigator.serviceWorker.controller) announce(registration.waiting);

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) announce(installing);
      });
    });

    // Installed PWAs can stay open for days: look for a new version whenever the app comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    });
  });
}
