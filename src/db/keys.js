// The ONLY place that builds localStorage key names.
//
// localStorage is shared per ORIGIN, not per repo: the German app lives on the
// same <username>.github.io origin. Every key this app writes starts with
// PREFIX, and nothing in the codebase may read, write or remove a key that
// doesn't (tests/banned-apis.test.js enforces this).

export const PREFIX = 'urdu-trainer:';

export const DATA_KEY = `${PREFIX}data`;
export const SNAPSHOTS_KEY = `${PREFIX}snapshots`;
const RECOVERY_PREFIX = `${PREFIX}recovery:`;

export function recoveryKey(isoTimestamp) {
  return `${RECOVERY_PREFIX}${isoTimestamp}`;
}

/** True only for keys that belong to this app. */
export function isOwnKey(key) {
  return typeof key === 'string' && key.startsWith(PREFIX);
}

export function isRecoveryKey(key) {
  return typeof key === 'string' && key.startsWith(RECOVERY_PREFIX);
}
