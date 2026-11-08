// #/games/<id>: checks the game can be played, then hands over to it. Lazy-loads one game module.
import { h } from '../../ui/dom.js';
import { store } from '../../db/storage.js';
import { getContent } from '../../db/contentLoader.js';
import { availability, gameById } from '../../games/catalog.js';
import { canSpeak } from '../../audio/tts.js';
import { gameOfDay, LOCK_MESSAGE } from './gotd.js';

const loaders = {
  'speed-recall': () => import('./speedRecall.js'),
  'listen-type': () => import('./listenType.js'),
  'sentence-sprint': () => import('./sentenceSprint.js'),
  'match-pairs': () => import('./matchPairs.js'),
};

export function lockedNote(a) {
  if (a.reason === 'voice') return 'Needs a voice that can speak Urdu or Hindi, and this device has none.';
  return a.unlocksAfter ? `Unlocks after lesson ${a.unlocksAfter}.` : 'Unlocks as more lessons arrive.';
}

export async function renderGame(container, id) {
  const game = gameById(id);
  if (!game || !loaders[id]) return void location.replace('#/games');
  const a = availability(id, { data: store.data, content: getContent(), now: Date.now(), canListen: canSpeak({ roman: 'x', ur: 'x' }) });
  if (!a.ok) {
    container.append(h('main', { class: 'page' }, h('a', { class: 'back', href: '#/games' }, '‹ Games'), h('h1', {}, game.title), h('section', { class: 'card' }, h('p', {}, lockedNote(a)))));
    return () => {};
  }
  const gotd = gameOfDay();
  if (gotd?.isLocked(id)) {
    container.append(h('main', { class: 'page' }, h('a', { class: 'back', href: '#/games' }, '‹ Games'), h('h1', {}, game.title), h('section', { class: 'card game-card locked' }, h('p', {}, LOCK_MESSAGE), h('p', { class: 'muted' }, `Today’s game is ${gotd.game.title}. One full round unlocks the rest.`), h('a', { class: 'btn', href: `#/games/${gotd.game.id}` }, `Play ${gotd.game.title}`))));
    return () => {};
  }
  const mod = await loaders[id]();
  return mod.render(container);
}
