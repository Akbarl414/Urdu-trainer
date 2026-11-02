import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSpeech } from '../src/audio/speakPlan.js';

const ur = { lang: 'ur-PK', name: 'Urdu', localService: true };
const hi = { lang: 'hi-IN', name: 'Lekha', localService: true };
const en = { lang: 'en-US', name: 'Samantha', localService: true };
const item = { roman: 'maiN Thiik huuN', ur: 'میں ٹھیک ہوں' };

test('audio file always wins', () => {
  assert.deepEqual(planSpeech({ ...item, audio: 'audio/a.mp3' }, [ur, hi]), { kind: 'file', src: 'audio/a.mp3' });
  assert.equal(planSpeech({ ...item, audio: 'audio/a.mp3' }, []).kind, 'file');
});
test('Urdu voice speaks the ur field, ahead of Hindi', () => {
  const p = planSpeech(item, [hi, ur, en]);
  assert.equal(p.kind, 'ur');
  assert.equal(p.text, item.ur);
  assert.equal(p.voice, ur);
});
test('no Urdu voice: Hindi voice speaks converted roman', () => {
  const p = planSpeech(item, [en, hi]);
  assert.equal(p.kind, 'hi');
  assert.equal(p.text, 'मैं ठीक हूँ');
  assert.equal(p.lang, 'hi-IN');
});
test('loanwords pass through on the Hindi path', () => {
  assert.equal(planSpeech({ roman: 'phone hai' }, [hi], { loanwords: ['phone'] }).text, 'phone है');
});
test('neither voice: none', () => {
  assert.equal(planSpeech(item, [en]).kind, 'none');
  assert.equal(planSpeech(item, []).kind, 'none');
});
