#!/usr/bin/env node
// Regenerates public/icons/*.png from the SVG artwork below. Needs rsvg-convert
// (macOS: `brew install librsvg`). The PNGs are committed, so you only run
// this if you change the artwork.   npm run icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

const art = (rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rx}" fill="#1F6B66"/>
  <rect x="116" y="140" width="280" height="190" rx="64" fill="#FAF6EF"/>
  <polygon points="190,318 190,394 266,326" fill="#FAF6EF"/>
  <circle cx="186" cy="235" r="19" fill="#C98A2B"/>
  <circle cx="256" cy="235" r="19" fill="#C98A2B"/>
  <circle cx="326" cy="235" r="19" fill="#C98A2B"/>
</svg>
`;

writeFileSync(join(out, 'icon.svg'), art(112)); // rounded: browser tab / launcher
const fullBleed = join(out, '_fullbleed.svg');
writeFileSync(fullBleed, art(0)); // no rounding: iOS and maskable icons are cropped by the OS

const png = (svg, size, name) => execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), svg, '-o', join(out, name)]);
png(join(out, 'icon.svg'), 192, 'icon-192.png');
png(join(out, 'icon.svg'), 512, 'icon-512.png');
png(fullBleed, 512, 'icon-maskable-512.png');
png(fullBleed, 180, 'icon-180.png');
execFileSync('rm', [fullBleed]);
console.log('icons written to public/icons');
