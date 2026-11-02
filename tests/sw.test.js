import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(here, '../src/sw/sw.js'), 'utf8');

/** Runs the real service-worker source against fake caches and returns the harness. */
function boot({ existingCaches = [], buildId = 'new1', scope = 'https://user.github.io/Urdu-trainer/', precache = ['index.html'] } = {}) {
  const store = new Map(existingCaches.map((n) => [n, new Map()]));
  const deleted = [];
  const globalMatchCalls = [];
  const makeCache = (name) => ({
    match: async (req) => store.get(name).get(typeof req === 'string' ? req : req.url) ?? undefined,
    add: async (url) => store.get(name).set(url, { url, from: name }),
    put: async (req, res) => store.get(name).set(req.url, res),
  });
  const caches = {
    keys: async () => [...store.keys()],
    open: async (name) => (store.has(name) || store.set(name, new Map()), makeCache(name)),
    delete: async (name) => (deleted.push(name), store.delete(name)),
    match: async (...a) => (globalMatchCalls.push(a), undefined),
  };
  const listeners = {};
  let skipped = false;
  let claimed = false;
  const self = {
    registration: { scope },
    addEventListener: (type, fn) => (listeners[type] = fn),
    skipWaiting: () => (skipped = true),
    clients: { claim: async () => (claimed = true) },
  };
  const src = template.replace('__BUILD_ID__', buildId).replace('__PRECACHE__', JSON.stringify(precache));
  vm.runInNewContext(src, { self, caches, URL, Response, fetch: async () => ({ ok: true, status: 200, clone() { return this; } }), console });
  const run = async (type, event) => {
    let p;
    listeners[type]({ ...event, waitUntil: (x) => (p = x) });
    await p;
  };
  return { store, deleted, globalMatchCalls, listeners, run, state: () => ({ skipped, claimed }) };
}

test('activate deletes only OLD urdu-trainer-static-* caches and nothing else', async () => {
  const h = boot({
    buildId: 'new1',
    existingCaches: ['urdu-trainer-static-old1', 'urdu-trainer-static-old2', 'urdu-trainer-static-new1', 'urdu-trainer-fonts-v1', 'urdu-trainer-audio-v1', 'deutsch-trainer-v1', 'german-app-v2', 'workbox-precache', 'urdu-trainer-staticX'],
  });
  await h.run('activate', {});
  assert.deepEqual(h.deleted.sort(), ['urdu-trainer-static-old1', 'urdu-trainer-static-old2']);
  for (const keep of ['urdu-trainer-static-new1', 'urdu-trainer-fonts-v1', 'urdu-trainer-audio-v1', 'deutsch-trainer-v1', 'german-app-v2', 'workbox-precache']) {
    assert.ok(h.store.has(keep), `${keep} must survive`);
  }
  assert.equal(h.state().claimed, true);
});

test('install precaches into the prefixed static cache and does NOT skip waiting', async () => {
  const h = boot({ precache: ['index.html', 'assets/app.js', 'fonts/noto.woff2'] });
  await h.run('install', {});
  assert.deepEqual([...h.store.keys()].sort(), ['urdu-trainer-fonts-v1', 'urdu-trainer-static-new1']);
  assert.equal(h.store.get('urdu-trainer-static-new1').size, 2);
  assert.equal(h.store.get('urdu-trainer-fonts-v1').size, 1);
  assert.equal(h.state().skipped, false, 'an update must wait for the user to press Reload');
});

test('SKIP_WAITING message activates the waiting worker', () => {
  const h = boot();
  h.listeners.message({ data: { type: 'SKIP_WAITING' } });
  assert.equal(h.state().skipped, true);
  const h2 = boot();
  h2.listeners.message({ data: { type: 'something-else' } });
  assert.equal(h2.state().skipped, false);
});

test('fetch ignores requests outside its scope (other apps on the same origin) and never uses global caches.match', async () => {
  const h = boot();
  let responded = 0;
  const fire = (url, extra = {}) => h.listeners.fetch({ request: { method: 'GET', url, mode: 'cors', headers: new Headers(), ...extra }, respondWith: () => responded++ });
  fire('https://user.github.io/German-Language-App/index.html');
  fire('https://user.github.io/German-Language-App/', { mode: 'navigate' });
  fire('https://example.com/x.js');
  fire('https://user.github.io/Urdu-trainer/x.js', { method: 'POST' });
  assert.equal(responded, 0);
  fire('https://user.github.io/Urdu-trainer/assets/app.js');
  assert.equal(responded, 1);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.globalMatchCalls.length, 0);
});

test('source never calls the global caches.match and only deletes via the prefix filter', () => {
  assert.doesNotMatch(template, /(^|[^.\w])caches\.match\(/m);
  const deletes = template.match(/caches\.delete\(/g) || [];
  assert.equal(deletes.length, 1);
  assert.match(template, /k\.startsWith\(STATIC_PREFIX\) && k !== STATIC_CACHE/);
});
