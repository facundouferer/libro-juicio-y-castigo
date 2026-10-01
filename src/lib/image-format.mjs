/**
 * Which module a photograph takes.
 *
 * The fourth editorial pass (docs/cambios_1_oct_2026.md) replaced the old
 * three containers with a scale catalog, `src/data/image-scale.json`, which is
 * the single source of truth for every edition:
 *
 *   box-ficha   50 % of the text box, centred. Portraits and individual
 *               drawings. Never a full page.
 *   box-caja    100 % of the text box. Courtroom, press, plans, the site.
 *   box-plano   100 % of the box, on an odd page of its own in the PDF. The
 *               two large plans of the building.
 *
 * Pairs and the 2 × 2 grid are not containers of one image but modules of
 * several: the anchoring plugin groups them (see `moduleOf`).
 *
 * The old behaviour read an aspect ratio where it should have read an editorial
 * decision. An image the catalog does not list falls back to orientation —
 * a vertical individual reads as a ficha, anything else as a caja — and
 * `IMAGE_FORMAT` in the manifest can still override any of them by hand.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DRAWING_PATTERN, IMAGE_FORMAT } from '../../scripts/manifest.mjs';

export const CONTAINERS = ['box-ficha', 'box-caja', 'box-plano'];

const SCALE = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '..', 'data', 'image-scale.json'), 'utf8'),
);

/** Image key → 'ficha' | 'caja' | 'plano'. */
export const MODULES = SCALE.modules;
/** Pairs of keys that sit side by side, in reading order. */
export const DUOS = SCALE.duos;
/** Groups of four keys set as a 2 × 2 grid. */
export const GRIDS = SCALE.grids;

/**
 * @param {string} key                the image key, e.g. '018bis'
 * @param {object} entry              its record in src/data/images.json
 * @param {object} [caption]          its record in src/data/captions.json
 * @returns {'box-ficha'|'box-caja'|'box-plano'}
 */
export function containerFor(key, entry, caption) {
  const override = IMAGE_FORMAT[key];
  if (override && CONTAINERS.includes(override)) return override;

  const scale = MODULES[key];
  if (scale) return `box-${scale}`;

  // Not in the catalog: a vertical individual or a drawing is a ficha.
  if (isDrawing(caption) || (entry?.orientation ?? 'landscape') === 'portrait') return 'box-ficha';
  return 'box-caja';
}

/**
 * The multi-image module a key belongs to, if any.
 * @returns {{ kind: 'duo'|'grid2x2', keys: string[] } | null}
 */
export function moduleOf(key) {
  const duo = DUOS.find((keys) => keys.includes(key));
  if (duo) return { kind: 'duo', keys: duo };
  const grid = GRIDS.find((keys) => keys.includes(key));
  if (grid) return { kind: 'grid2x2', keys: grid };
  return null;
}

/** Whether the archive's epigraph describes a drawing, a plan or a file photo. */
export function isDrawing(caption) {
  return DRAWING_PATTERN.test(String(caption?.caption ?? ''));
}
