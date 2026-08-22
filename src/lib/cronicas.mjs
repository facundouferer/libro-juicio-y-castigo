/**
 * What counts as the opening of a chronicle.
 *
 * The manuscript writes each chronicle as a pair of headings:
 *
 *     # CAUSA BRIGADA I 7 julio 2010                  ← the volanta: causa and date
 *     ## “LA TORTURA EN EL CHACO COMENZÓ EN EL 74…”   ← the headline
 *
 * The heading level describes the structure of the document, not the visual
 * hierarchy, and reading it as hierarchy is what set the volanta 30 % larger
 * than the headline it is supposed to introduce (spec 04, RF-04.1).
 *
 * A volanta is an `h1` that names the causa. Over the 36 `h1` headings in the
 * book that rule keeps 34 and correctly leaves out the two that are not
 * volantas: the title of the Chachi interlude, and «SENTENCIA: JUICIO Y CASTIGO
 * RECARGADO», an internal subtitle of «Las condenas».
 *
 * The rule is a default, not a dogma: `VOLANTA_OVERRIDE` in the manifest can
 * force or deny any heading, and `npm run revision` prints the whole
 * classification so a change to the manuscript cannot alter the layout in
 * silence (RF-04.2).
 */

import { VOLANTA_OVERRIDE } from '../../scripts/manifest.mjs';

/** A heading that names the causa opens a chronicle. */
export const VOLANTA_PATTERN = /\b(brigada|caballero)\b/i;

/**
 * @param {number|string} depth   heading level, 1–6, or the tag name
 * @param {string} text           the heading's plain text
 * @param {string} [id]           its anchor id, for the override lookup
 */
export function isVolanta(depth, text, id) {
  const level = typeof depth === 'string' ? Number(depth.replace(/^h/, '')) : depth;
  if (level !== 1) return false;
  if (id && Object.hasOwn(VOLANTA_OVERRIDE, id)) return VOLANTA_OVERRIDE[id];
  return VOLANTA_PATTERN.test(String(text ?? ''));
}
