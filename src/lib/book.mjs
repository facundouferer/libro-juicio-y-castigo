/**
 * Read-side access to the generated data.
 *
 * Four files are produced ahead of the build and consumed here:
 *   images.json     every derivative's dimensions, widths and placeholder
 *   captions.json   the parsed epigraphs, bound to their image
 *   image-map.json  which image belongs to which heading
 *   headings.json   the book's structure, for the contents modal
 */

import images from '../data/images.json';
import captions from '../data/captions.json';
import imageMap from '../data/image-map.json';
import headings from '../data/headings.json';
import { sources, altFor } from './images.mjs';

const captionByKey = new Map(captions.images.map((c) => [c.key, c]));

export const SECTIONS = headings.sections;
export const ENTRIES = headings.entries;

export function captionFor(key) {
  return captionByKey.get(key) ?? null;
}

export function imageEntry(key, set = 'content') {
  return images[set]?.[key] ?? null;
}

/**
 * The single image a chapter opening or an interlude carries, if the mapping
 * gave it one. Documents with headings get theirs injected inline instead.
 */
export function documentImage(docSlug, set = 'content') {
  const key = imageMap.document?.[docSlug];
  if (!key) return null;
  const entry = imageEntry(key, set);
  if (!entry) return null;
  const caption = captionFor(key);
  return { key, entry, caption, src: sources(entry, set), alt: altFor(caption) };
}

/** Every image anchored anywhere inside a document, in reading order. */
export function documentAnchors(docSlug) {
  const anchors = imageMap.anchors?.[docSlug] ?? {};
  return Object.entries(anchors).map(([headingId, key]) => ({ headingId, key }));
}

/** How many images the mapping placed, and how many are still unplaced. */
export function mapStats() {
  const anchored = Object.values(imageMap.anchors ?? {}).reduce((n, doc) => n + Object.keys(doc).length, 0);
  const onDocuments = Object.keys(imageMap.document ?? {}).length;
  return {
    total: Object.keys(images.content ?? {}).length,
    anchored,
    onDocuments,
    placed: anchored + onDocuments,
    review: imageMap.review ?? [],
  };
}

export { sources, altFor };
