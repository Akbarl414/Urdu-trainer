import { defineConfig } from 'vite';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// One id per build, shared by the app (update banner / debug page) and the service worker (cache name).
const BUILD_ID = (process.env.GITHUB_SHA || '').slice(0, 7) || Date.now().toString(36);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Emits dist/sw.js from src/sw/sw.js with the build id and the list of files to precache. */
function serviceWorkerPlugin() {
  let publicDir;
  return {
    name: 'urdu-trainer-service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle); // index.html, assets/*.js, assets/*.css, …
      let publicFiles = [];
      try {
        publicFiles = walk(publicDir).map((p) => relative(publicDir, p).split('\\').join('/'));
      } catch {
        /* no public dir */
      }
      // audio/ is cached on first play; sw.js is the worker itself.
      const precache = [...new Set([...built, ...publicFiles])].filter((f) => !f.startsWith('audio/') && f !== 'sw.js' && !f.startsWith('.')).sort();
      const template = readFileSync(new URL('./src/sw/sw.js', import.meta.url), 'utf8');
      const source = template.replace('__BUILD_ID__', BUILD_ID).replace('__PRECACHE__', JSON.stringify(precache, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig(({ command }) => ({
  // Relative base so the build works from any GitHub Pages project path
  // (https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: './',
  define: { __BUILD_ID__: JSON.stringify(command === 'build' ? BUILD_ID : 'dev') },
  build: { outDir: 'dist' },
  plugins: [serviceWorkerPlugin()],
}));
