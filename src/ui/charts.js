// Small SVG charts drawn from theme tokens (no library). Each returns an <svg> that scales to its container.
// Colours are CSS variables, so a chart follows the theme and light/dark with no extra work. Marks are thin, the grid is quiet,
// and every chart has a text summary beside it (the caller adds it), so nothing depends on colour or on seeing the picture.
const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
const W = 320;
const H = 170;
const M = { l: 30, r: 8, t: 12, b: 24 };
const niceMax = (v) => {
  if (v <= 5) return 5;
  return v <= 20 ? Math.ceil(v / 2) * 2 : Math.ceil(v / 10) * 10;
};
/** Every nth label, plus the last; a label too close to the last one is dropped so they never collide. */
const showLabel = (i, n, want) => {
  const step = Math.ceil(n / want);
  return i === n - 1 || (i % step === 0 && n - 1 - i >= step * 0.7);
};
const shortDay = (day) => `${Number(day.slice(8))}/${Number(day.slice(5, 7))}`;

function frame(label, max, fmt, refs) {
  const g = el('g');
  const y = (v) => M.t + (1 - v / max) * (H - M.t - M.b);
  for (const v of [0, max / 2, max]) {
    g.append(el('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: 'ch-grid' }), el('text', { x: M.l - 4, y: y(v) + 3, 'text-anchor': 'end', class: 'ch-text' }, fmt(v)));
  }
  for (const r of refs) {
    if (r.value > max) continue;
    g.append(el('line', { x1: M.l, x2: W - M.r, y1: y(r.value), y2: y(r.value), class: 'ch-ref' }), el('text', { x: W - M.r, y: y(r.value) - 3, 'text-anchor': 'end', class: 'ch-text ch-ref-text' }, r.label));
  }
  return { g, y };
}

/**
 * @param {{ points: { day: string, value: number }[], refs?: { value: number, label: string }[], label: string, over?: number }} o
 *   over: bars above this value get the accent colour (days over the daily cap)
 */
export function barChart({ points, refs = [], label, over = Infinity }) {
  const max = niceMax(Math.max(1, ...points.map((p) => p.value), ...refs.map((r) => r.value * 1.1)));
  const { g, y } = frame(label, max, (v) => Math.round(v), refs);
  const slot = (W - M.l - M.r) / points.length;
  const bw = Math.max(3, Math.min(18, slot * 0.62));
  points.forEach((p, i) => {
    const x = M.l + slot * i + (slot - bw) / 2;
    const h = Math.max(p.value > 0 ? 2 : 0, (H - M.t - M.b) * (p.value / max));
    g.append(el('rect', { x, y: H - M.b - h, width: bw, height: h, rx: Math.min(4, bw / 2), class: `ch-bar${p.value > over ? ' ch-over' : ''}` }, el('title', {}, `${shortDay(p.day)}: ${p.value}`)));
    if (showLabel(i, points.length, 7)) g.append(el('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', class: 'ch-text' }, shortDay(p.day)));
  });
  return el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': label }, g);
}

/** Line with gaps where value is null. `percent` formats the axis as %, `zero` forces the axis to start at 0. */
export function lineChart({ points, refs = [], label, percent = false, floor = null }) {
  const vals = points.map((p) => p.value).filter((v) => v != null);
  let min = percent ? 0.4 : 0;
  let max = percent ? 1 : niceMax(Math.max(1, ...vals));
  if (percent && vals.length) min = Math.max(0, Math.min(...vals, ...refs.map((r) => r.value)) - 0.1);
  if (floor != null) min = floor;
  const span = max - min || 1;
  const fmt = (v) => (percent ? `${Math.round(v * 100)}%` : Math.round(v));
  const g = el('g');
  const y = (v) => M.t + (1 - (v - min) / span) * (H - M.t - M.b);
  for (const v of [min, min + span / 2, max]) g.append(el('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: 'ch-grid' }), el('text', { x: M.l - 4, y: y(v) + 3, 'text-anchor': 'end', class: 'ch-text' }, fmt(v)));
  for (const r of refs) g.append(el('line', { x1: M.l, x2: W - M.r, y1: y(r.value), y2: y(r.value), class: 'ch-ref' }), el('text', { x: W - M.r, y: y(r.value) - 3, 'text-anchor': 'end', class: 'ch-text ch-ref-text' }, r.label));
  const x = (i) => M.l + ((W - M.l - M.r) * i) / Math.max(1, points.length - 1);
  let d = '';
  let pen = false;
  points.forEach((p, i) => {
    if (p.value == null) return void (pen = false);
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`;
    pen = true;
  });
  if (d) g.append(el('path', { d, class: 'ch-line', fill: 'none' }));
  points.forEach((p, i) => {
    if (p.value != null) g.append(el('circle', { cx: x(i), cy: y(p.value), r: points.length > 20 ? 2 : 3, class: 'ch-dot' }, el('title', {}, `${shortDay(p.day)}: ${fmt(p.value)}`)));
    if (showLabel(i, points.length, 6)) g.append(el('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle', class: 'ch-text' }, shortDay(p.day)));
  });
  if (!vals.length) g.append(el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'ch-text' }, 'Not enough answers yet'));
  return el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': label }, g);
}
