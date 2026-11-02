import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUrduVoice, isHindiVoice, formatReport } from '../src/audio/voices.js';

test('isUrduVoice accepts ur, ur-PK, ur-IN, ur_PK and nothing else', () => {
  for (const lang of ['ur', 'ur-PK', 'ur-IN', 'UR-pk', 'ur_PK']) assert.equal(isUrduVoice({ lang }), true, lang);
  for (const lang of ['hi-IN', 'en-GB', 'urd', 'uk-UA', 'ar-SA', '', undefined]) assert.equal(isUrduVoice({ lang }), false, String(lang));
  assert.equal(isUrduVoice(null), false);
});

test('Hindi voices are detected separately and are never counted as Urdu', () => {
  assert.equal(isHindiVoice({ lang: 'hi-IN' }), true);
  assert.equal(isUrduVoice({ lang: 'hi-IN' }), false);
});

test('report lists counts and marks Urdu voices', () => {
  const voices = [
    { name: 'Daniel', lang: 'en-GB', localService: true, default: true },
    { name: 'Uzma', lang: 'ur-PK', localService: false, default: false },
    { name: 'Lekha', lang: 'hi-IN', localService: true, default: false },
  ];
  const text = formatReport(voices, { userAgent: 'test-ua' });
  assert.match(text, /Voices: 3/);
  assert.match(text, /Urdu \(ur\*\) voices: 1/);
  assert.match(text, /★ ur-PK\tUzma\tremote/);
  assert.match(text, /en-GB\tDaniel\tlocal\tdefault/);
});

test('report copes with no voices', () => {
  assert.match(formatReport([], { supported: false }), /NOT supported/);
});
