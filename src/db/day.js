// "Study day" helpers. A study day runs from rolloverHour (default 04:00 local
// time) to the next rolloverHour, so a review at 01:00 counts toward the
// previous day (like Anki). Streaks, daily caps and "one lesson a day" all use
// this — never toISOString(), which is UTC and wrong for an hour every summer.

const HOUR_MS = 3600 * 1000;

function pad(n) {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD' of the study day that `now` (epoch ms) falls in. */
export function studyDay(now = Date.now(), rolloverHour = 4) {
  const d = new Date(now - rolloverHour * HOUR_MS);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The study day before a 'YYYY-MM-DD' string (calendar arithmetic, DST-safe). */
export function previousDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`;
}
