// Blocking recovery screen, shown instead of the app whenever stored data could
// not be loaded safely (corrupt JSON, wrong shape, a newer version's data, or
// storage unavailable). Nothing here writes defaults over the user's data.
// Every destructive-looking action is explicit, confirmed, and keeps the raw copy.
import { h, download } from './dom.js';
import { ImportError } from '../db/storage.js';

export function showRecovery(container, store) {
  const info = store.recoveryInfo();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const say = (text, bad = true) => {
    feedback.textContent = text;
    feedback.className = `feedback ${bad ? 'bad' : 'good'}`;
  };

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: onFile });
  async function onFile() {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const preview = store.previewImport(await file.text());
      const s = preview.summary;
      const when = s.exportedAt ? new Date(s.exportedAt).toLocaleString() : 'unknown date';
      if (!confirm(`Backup from ${when}: ${s.mainCards} review cards, ${s.lessons} lessons.\n\nUse this backup now?`)) return;
      store.applyImport(preview);
      location.reload();
    } catch (e) {
      say(e instanceof ImportError ? e.message : `Import failed: ${e.message}`);
    } finally {
      fileInput.value = '';
    }
  }

  const snapshots = store.listSnapshots();

  container.replaceChildren(
    h(
      'main',
      { class: 'page recovery' },
      h('h1', {}, 'Your saved progress needs attention'),
      h('p', {}, info.message),
      info.detail ? h('p', { class: 'muted small' }, `Technical detail: ${info.detail}`) : null,
      h('p', {}, 'The app has stopped so that nothing is overwritten. Your data is still on this device.'),
      info.savedAs ? h('p', { class: 'muted small' }, 'A safety copy of the raw data was saved on this device.') : null,
      h(
        'div',
        { class: 'stack' },
        info.reason === 'newer-version' ? h('button', { class: 'btn', onclick: () => location.reload() }, 'Reload to update the app') : null,
        info.raw != null ? h('button', { class: 'btn', onclick: () => download(`urdu-trainer-raw-${stamp}.json`, info.raw) }, 'Download raw data') : null,
        h('button', { class: 'btn btn-secondary', onclick: () => fileInput.click() }, 'Import a backup file'),
        fileInput,
      ),
      snapshots.length && info.reason !== 'newer-version'
        ? h(
            'section',
            { class: 'card' },
            h('h2', {}, 'Restore an automatic snapshot'),
            ...snapshots.map((s) =>
              h(
                'div',
                { class: 'row' },
                h('span', {}, `${s.date} (${s.reason})`),
                h('button', {
                  class: 'btn btn-small',
                  onclick: () => {
                    if (!confirm(`Restore the snapshot from ${s.date}? Progress after that day will not be included.`)) return;
                    try {
                      store.restoreSnapshot(s.id);
                      location.reload();
                    } catch (e) {
                      say(`Restore failed: ${e.message}`);
                    }
                  },
                }, 'Restore'),
              ),
            ),
          )
        : null,
      feedback,
      info.reason === 'newer-version'
        ? null
        : h(
            'details',
            { class: 'card' },
            h('summary', {}, 'Start fresh instead'),
            h('p', {}, 'Removes this app’s saved progress and snapshots from this device and starts empty. The raw safety copy is kept. Download it first if you may want it back.'),
            h('button', {
              class: 'btn btn-danger',
              onclick: () => {
                if (!confirm('Start fresh? Your current saved progress will be removed from this device.')) return;
                if (!confirm('Really start fresh? This cannot be undone (the raw safety copy stays).')) return;
                store.eraseAll({ keepRecovery: true });
                location.reload();
              },
            }, 'Start fresh'),
          ),
    ),
  );
}
