// The learner's own lines in the right gender (PLAN D23). Pure.
//
// Content stores the man's form in the base fields and, where a woman would say it differently,
// a `learner_f` object whose fields REPLACE the base fields (shallow). This applies to dialogue
// lines spoken by the learner and to exercises where the learner speaks about themselves.
// settings.learnerGender is 'm', 'f' or null (not chosen yet: the base form is shown, and the
// woman's version is offered as `alt` so the screen can mention it).

/** @typedef {'m'|'f'|null|undefined} LearnerGender */

/**
 * The item as this learner should see it, without its `learner_f` field.
 * @template T
 * @param {T & { learner_f?: object }} item  an exercise or a dialogue line
 * @param {LearnerGender} gender
 * @returns {T}
 */
export function forLearner(item, gender) {
  if (!item || !item.learner_f) return item;
  const { learner_f: f, ...base } = item;
  return gender === 'f' ? { ...base, ...f } : base;
}

/**
 * The other gender's version, when the screen should mention it: only while no gender has been
 * chosen and the item has a woman's version. Otherwise null.
 * @param {{ learner_f?: object }} item
 * @param {LearnerGender} gender
 */
export function learnerAlt(item, gender) {
  if (!item?.learner_f || gender === 'm' || gender === 'f') return null;
  const { learner_f: f, ...base } = item;
  return { ...base, ...f };
}

/** True when this item differs for a woman learner. */
export const hasLearnerVariant = (item) => !!item?.learner_f;
