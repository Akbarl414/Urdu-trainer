// A minimal in-memory stand-in for localStorage, with an optional quota.
export function memoryStorage({ quotaBytes = Infinity, initial = {} } = {}) {
  const map = new Map(Object.entries(initial));
  const size = () => [...map].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem(k, v) {
      v = String(v);
      const prev = map.has(k) ? map.get(k) : null;
      map.set(k, v);
      if (size() > quotaBytes) {
        if (prev === null) map.delete(k);
        else map.set(k, prev);
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      }
    },
    removeItem: (k) => void map.delete(k),
    _keys: () => [...map.keys()],
    _map: map,
  };
}
