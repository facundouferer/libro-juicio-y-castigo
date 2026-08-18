/**
 * Builds the markup for a pre-derived image.
 *
 * Every variant already exists under public/img — see scripts/optimize-images.mjs
 * — so nothing here resizes or re-encodes. The job is only to assemble the
 * <picture> sources, the intrinsic size that reserves layout space, and the
 * blur-up placeholder that fills the plate while the full image streams in.
 */

import { withBase } from './site.mjs';

/**
 * @param {object} entry  a record from src/data/images.json
 * @param {string} set    'content' | 'edificio'
 */
export function sources(entry, set = 'content') {
  const dir = `/img/${set}`;
  return {
    avif: entry.avif.map((w) => `${withBase(`${dir}/${entry.key}-${w}.avif`)} ${w}w`).join(', '),
    webp: entry.webp.map((w) => `${withBase(`${dir}/${entry.key}-${w}.webp`)} ${w}w`).join(', '),
    // The widest WebP is the <img> fallback: a browser that understood neither
    // source would not be running this site anyway, but it costs nothing.
    fallback: withBase(`${dir}/${entry.key}-${entry.webp.at(-1)}.webp`),
    width: entry.width,
    height: entry.height,
    lqip: entry.lqip,
  };
}

/**
 * Alt text for a photograph in a book about state terrorism.
 *
 * The epigraph is the only description anyone wrote for these images, and it
 * was written by the people who hold the archive. Nothing is invented here: an
 * image with no epigraph gets an empty alt and is exposed as decorative rather
 * than described by guesswork.
 */
export function altFor(caption) {
  if (!caption?.caption) return '';
  return caption.caption.length > 240 ? `${caption.caption.slice(0, 237)}…` : caption.caption;
}

/** Escapes a string for interpolation into an HTML attribute. */
export function attr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
