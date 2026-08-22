/**
 * Which container a photograph takes.
 *
 * The editorial pass asked for three, and no fourth (specs-v12, spec 07):
 *
 *   box-full        the full width of the text box. Press photographs, group
 *                   shots, the courtroom, the plaza. The dominant format.
 *   box-two-thirds  two thirds, centred, nothing alongside. Portraits,
 *                   drawings, file photographs.
 *   box-page        the whole page. Reserved.
 *
 * What it replaces was one line — portrait and well scanned meant a full page —
 * which sent about a third of the book's 105 images to a page of their own. The
 * full page is now a decision, not a side effect of an aspect ratio.
 */

import { DRAWING_PATTERN, FULL_PAGE_IMAGES, IMAGE_FORMAT } from '../../scripts/manifest.mjs';

export const CONTAINERS = ['box-full', 'box-two-thirds', 'box-page'];

/**
 * @param {string} key                the image key, e.g. '018bis'
 * @param {object} entry              its record in src/data/images.json
 * @param {object} [caption]          its record in src/data/captions.json
 * @returns {'box-full'|'box-two-thirds'|'box-page'}
 */
export function containerFor(key, entry, caption) {
  const override = IMAGE_FORMAT[key];
  if (override && CONTAINERS.includes(override)) return override;

  // Reserved: the section covers and the plans of the building (RF-07.4).
  if (FULL_PAGE_IMAGES.has(key)) return 'box-page';

  // A drawing has no background and a file photograph is small and vertical:
  // both read as an object on the page, not as a view through it.
  if (isDrawing(caption)) return 'box-two-thirds';
  if ((entry?.orientation ?? 'landscape') === 'portrait') return 'box-two-thirds';

  return 'box-full';
}

/** Whether the archive's epigraph describes a drawing, a plan or a file photo. */
export function isDrawing(caption) {
  return DRAWING_PATTERN.test(String(caption?.caption ?? ''));
}
