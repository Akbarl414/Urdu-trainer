// A bag of cleanup functions for one screen: recorders, timers, subscriptions. Run it when the screen goes away.
export function createScope() {
  const fns = [];
  return {
    add(fn) {
      fns.push(fn);
      return fn;
    },
    /** Run and forget everything registered so far. */
    run() {
      for (const fn of fns.splice(0)) {
        try {
          fn();
        } catch (e) {
          console.error(e);
        }
      }
    },
  };
}
