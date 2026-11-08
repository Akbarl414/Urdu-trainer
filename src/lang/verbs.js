// Verb facts derived from checked vocab fields. Pure.

/**
 * True when a verb's perfective can't be predicted from its stem, so it needs its own card (PLAN D28).
 * Regular means stem + aa (rahaa, maraa) or, after a vowel, stem + yaa (khaayaa, aayaa).
 * Irregular: gayaa, kiyaa, diyaa, liyaa, huaa, piyaa.
 * @param {{ stem?: { roman: string }, perfective?: { m_sg: { roman: string } } }} word
 */
export function isIrregularPerfective(word) {
  const m = word?.perfective?.m_sg?.roman;
  const stem = word?.stem?.roman;
  if (!m || !stem) return false;
  return m !== `${stem}aa` && !(/[aeiou]$/.test(stem) && m === `${stem}yaa`);
}
