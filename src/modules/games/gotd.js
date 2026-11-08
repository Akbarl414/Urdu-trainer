// UI side of the game of the day (PLAN D37): reads what is unlocked on this device, makes sure today has a pick (saving it
// the first time), and says whether a given game is locked. The rules themselves live in src/games/gameOfDay.js.
import { store } from '../../db/storage.js';
import { getContent } from '../../db/contentLoader.js';
import { studyDay } from '../../db/day.js';
import { GAMES, availability, gameById } from '../../games/catalog.js';
import { ensureGameOfDay, isLockedToday } from '../../games/gameOfDay.js';
import { canSpeak } from '../../audio/tts.js';

export const LOCK_MESSAGE = 'Play today’s game first.';

const context = () => ({ data: store.data, content: getContent(), now: Date.now(), canListen: canSpeak({ roman: 'x', ur: 'x' }) });

/**
 * @returns {{ day: string, game: any, done: boolean, isLocked: (id: string) => boolean } | null}  null when no game is unlocked yet
 */
export function gameOfDay() {
  const ctx = context();
  const day = studyDay(ctx.now, ctx.data.settings.dayRolloverHour);
  const playable = (id) => availability(id, ctx).ok;
  const before = ctx.data.stats.gameOfDay;
  const rec = ensureGameOfDay(ctx.data, day, GAMES.filter((g) => playable(g.id)).map((g) => g.id));
  if (ctx.data.stats.gameOfDay !== before) store.save(); // the pick is made once a day, so this is one small write
  if (!rec) return null;
  return { day, game: gameById(rec.id), done: rec.done, isLocked: (id) => isLockedToday(ctx.data, day, id, playable) };
}
