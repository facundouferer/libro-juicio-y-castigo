/**
 * Anchors the book's photographs to the headings they illustrate.
 *
 * The original manuscript carries no image references at all — the 105
 * photographs and the 241 headings were two separate lists until the mapping
 * pass tied them together. This plugin is where that mapping becomes markup.
 *
 * A heading owns a sequence, not a single image, and its figures are spread
 * through the paragraphs that follow it rather than stacked underneath it. The
 * plate advances as the reader scrolls, so a chronicle carrying four
 * photographs reveals them across its length instead of showing all four on
 * one screen and running blank for the rest.
 *
 * The figure is the single source of truth for that image in the DOM. On a
 * phone it is what the reader sees, inline under its heading. On a desktop it
 * is hidden by CSS and the sticky plate mirrors it, driven by the data
 * attributes written here — so there is never a second copy to keep in sync.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { visit } from 'unist-util-visit';
import Slugger from 'github-slugger';
import { sources, altFor } from './images.mjs';
import { isVolanta } from './cronicas.mjs';
import { containerFor, isDrawing } from './image-format.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function loadJson(relative, fallback) {
  const file = path.join(ROOT, relative);
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Widths the plate and the inline figure actually render at. */
const SIZES = '(max-width: 900px) 100vw, 42vw';

const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });

/** Flattens a heading's hast children back to plain text for the slugger. */
function textOf(node) {
  let out = '';
  visit(node, 'text', (child) => {
    out += child.value;
  });
  return out.trim();
}

/**
 * @param {object}  [options]
 * @param {'web'|'print'|'epub'} [options.target]
 *   `web` emits the responsive <picture> the site serves. `print` and `epub`
 *   emit a single <img> pointing at the flat derivative each build copies in,
 *   because neither a PDF nor an EPUB reader negotiates srcset.
 * @param {(file: any) => object} [options.frontmatterOf]
 *   How to reach the document's frontmatter — Astro parks it on the vfile, the
 *   standalone pipeline passes it in directly.
 */
export function rehypeAnchorImages(options = {}) {
  const target = options.target ?? 'web';
  const frontmatterOf = options.frontmatterOf ?? ((file) => file?.data?.astro?.frontmatter);

  // Loaded once per build rather than per file; the dev server restarts on
  // changes to these, which is the right granularity for generated data.
  const imageMap = loadJson('src/data/image-map.json', { anchors: {} });
  const images = loadJson('src/data/images.json', { content: {} });
  const captions = loadJson('src/data/captions.json', { images: [] });
  const captionByKey = new Map(captions.images.map((c) => [c.key, c]));

  return (tree, file) => {
    const frontmatter = frontmatterOf(file);
    if (!frontmatter) return;

    // The collection id is `NN-slug`; the mapping keys on the slug alone.
    const docSlug = String(frontmatter.docSlug ?? '').trim();
    const anchors = imageMap.anchors?.[docSlug];
    if (!anchors) return;

    const slugger = new Slugger();
    const used = new Set();

    // Two passes. The first records where each heading sits and which images it
    // owns; the second inserts, walking backwards so earlier indices stay valid.
    const plan = [];

    visit(tree, 'element', (node, index, parent) => {
      if (!/^h[1-6]$/.test(node.tagName) || !parent || index === null) return;

      // Astro's own slug pass has already run, so the id is normally present;
      // recompute it only if it is not, keeping the counter in step either way.
      const headingText = textOf(node);
      const slug = slugger.slug(headingText);
      const id = node.properties?.id ?? slug;
      if (!node.properties.id) node.properties.id = id;

      const volanta = isVolanta(node.tagName, headingText, id);

      const owned = anchors[id] ?? anchors[slug];
      const keys = owned
        ? (Array.isArray(owned) ? owned : [owned]).filter((k) => !used.has(k))
        : [];
      for (const k of keys) used.add(k);

      // Volantas are recorded even with no images of their own: they are the
      // boundaries of the chronicles, and the chronicle is the unit the printed
      // editions anchor to (specs-v12, spec 06, RF-06.1).
      if (!keys.length && !volanta) return;
      plan.push({ parent, index, keys, id, volanta });
    });

    // A volanta owns no page of its own: the images the map anchored to it
    // belong to the chronicle it opens, and emitting them where the volanta
    // sits would put a photograph between a chronicle's title and its first
    // paragraph — which is exactly what the editorial pass forbade (RF-06.3).
    for (let i = 0; i < plan.length; i += 1) {
      if (!plan[i].volanta || !plan[i].keys.length) continue;
      const next = plan[i + 1];
      if (next && next.parent === plan[i].parent) {
        next.keys = [...plan[i].keys, ...next.keys];
        plan[i].keys = [];
      }
    }

    if (target === 'web') {
      for (const step of [...plan].reverse()) insertSequence(step);
    } else {
      insertByChronicle(plan);
    }

    /**
     * On paper the unit is the chronicle, not the heading.
     *
     * The previous pass already kept photographs off the middle of a paragraph
     * run by emitting them at the end of each heading's span. It was not
     * enough: a heading span is a subsection *inside* a chronicle that is still
     * running, so for a reader the photograph still interrupted it.
     *
     * So every image a chronicle owns is held back and emitted once, after its
     * last paragraph and before the volanta of the next one. Combined with each
     * chronicle opening on a recto (spec 05), that puts the images in the space
     * the text leaves at the foot of the last page — «el texto siempre manda».
     */
    function insertByChronicle(steps) {
      const groups = [];
      /** Headings that belong to no chronicle — see below. */
      const loose = [];
      let current = null;

      for (const step of steps) {
        if (step.volanta) {
          current = { parent: step.parent, start: step.index, keys: [], ids: [] };
          groups.push(current);
        }
        if (!step.keys.length) continue;

        // Before the first volanta — or in a document with none at all, like
        // «Los fallos» or «Alegatos» — there is no chronicle to defer to, so the
        // heading span stays the unit (RF-06.1, exception).
        if (!current || current.parent !== step.parent) {
          loose.push(step);
          continue;
        }
        current.keys.push(...step.keys);
        current.ids.push(step.id);
      }

      for (const group of groups.reverse()) {
        if (!group.keys.length) continue;
        const siblings = group.parent.children;

        // The chronicle runs to the next volanta, or to the end of the document.
        let end = siblings.length;
        for (let i = group.start + 1; i < siblings.length; i += 1) {
          const node = siblings[i];
          if (node.type !== 'element' || !/^h1$/.test(node.tagName)) continue;
          if (isVolanta(node.tagName, textOf(node), node.properties?.id)) {
            end = i;
            break;
          }
        }

        const figures = group.keys.map((key, i) => buildFigure(key, group.ids[i] ?? group.ids[0])).filter(Boolean);
        if (!figures.length) continue;

        // Grouped rather than loose, so the printed edition can anchor the lot
        // to the foot of the page the text left free (RF-06.2).
        siblings.splice(end, 0, el('div', { className: ['tail-figures'] }, figures));
      }

      // Last, and backwards, so none of the splices above or below moves an
      // index another one still depends on.
      for (const step of loose.reverse()) insertSequence(step);
    }

    /**
     * Places a heading's images through the text that follows it rather than
     * stacking them at the top.
     *
     * The plate advances as the reader scrolls, so a chronicle carrying four
     * photographs shows them one after another across its length. Stacking
     * them at the heading would put four images on one screen and leave the
     * rest of the chronicle with a blank plate.
     */
    function insertSequence({ parent, index, keys, id }) {
      const siblings = parent.children;

      // Everything from this heading to the next one is its span.
      let end = siblings.length;
      for (let i = index + 1; i < siblings.length; i += 1) {
        const node = siblings[i];
        if (node.type === 'element' && /^h[1-6]$/.test(node.tagName)) {
          end = i;
          break;
        }
      }

      // Candidate slots: after each block-level child inside the span.
      const slots = [];
      for (let i = index + 1; i < end; i += 1) {
        const node = siblings[i];
        if (node.type === 'element' && ['p', 'blockquote', 'ul', 'ol', 'table'].includes(node.tagName)) {
          slots.push(i);
        }
      }

      const figures = keys.map((key) => buildFigure(key, id)).filter(Boolean);
      if (!figures.length) return;

      // On paper the reading is continuous and a photograph dropped between two
      // paragraphs breaks it. So the printed editions place a heading's images
      // at the end of its span — a change of heading, which is a boundary the
      // reader has already stopped at — instead of spreading them through the
      // prose (spec 03, RF-03.1). On screen the spreading is the whole point:
      // the plate advances as the reader scrolls.
      if (target !== 'web') {
        siblings.splice(end, 0, ...figures);
        return;
      }

      // With no room to breathe, the images sit directly under the heading.
      if (slots.length < 2) {
        siblings.splice(index + 1, 0, ...figures);
        return;
      }

      // Spread evenly, offset by half a step so the first image lands after the
      // opening paragraph rather than displacing it.
      const positions = figures.map((_, i) =>
        slots[Math.min(slots.length - 1, Math.floor(((i + 0.5) / figures.length) * slots.length))],
      );

      for (let i = figures.length - 1; i >= 0; i -= 1) {
        siblings.splice(positions[i] + 1, 0, figures[i]);
      }
    }

    function buildFigure(key, anchorId) {
      const entry = images.content?.[key];
      if (!entry) return null;

      const caption = captionByKey.get(key);
      const src = sources(entry, 'content');
      const alt = altFor(caption);

      const figcaption = [];
      if (caption?.caption) figcaption.push(text(caption.caption));
      if (caption?.credit) {
        figcaption.push(el('span', { className: ['credit'] }, [text(caption.credit)]));
      }

      // `printQuality` decides how much page an image may claim: the eight
      // scans that fall under 200 dpi at A5 are held to half a page, where the
      // softness reads as a small archival photograph rather than as a fault.
      const quality = entry.printQuality ?? 'full';

      const picture =
        target === 'web'
          ? el('picture', {}, [
              el('source', { type: 'image/avif', srcSet: src.avif, sizes: SIZES }),
              el('source', { type: 'image/webp', srcSet: src.webp, sizes: SIZES }),
              el('img', {
                src: src.fallback,
                alt,
                width: src.width,
                height: src.height,
                loading: 'lazy',
                decoding: 'async',
                // Decorative when the archive left no epigraph — better an
                // honest silence than a description nobody wrote.
                role: alt ? undefined : 'presentation',
              }),
            ])
          : el('img', {
              src: target === 'print' ? `img/${key}.jpg` : `../images/${key}.jpg`,
              alt,
              width: src.width,
              height: src.height,
            });

      const body =
        target === 'web'
          ? el(
              'button',
              {
                type: 'button',
                dataZoom: key,
                'aria-label': caption?.caption ? `Ampliar: ${caption.caption.slice(0, 80)}` : 'Ampliar la imagen',
              },
              [picture],
            )
          : picture;

      // Three containers and no fourth (specs-v12, spec 07, RF-07.1). What this
      // replaces sent every well-scanned vertical photograph to a page of its
      // own — about a third of the book — because the rule read an aspect ratio
      // where it should have read an editorial decision.
      const container = containerFor(key, entry, caption);

      const figure = el(
        'figure',
        {
          className: [
            'figure',
            `q-${quality}`,
            entry.orientation ?? 'landscape',
            container,
            // A drawing has no background: stacked against a photograph it makes
            // the noise the editorial pass described (spec 07, RF-07.6).
            ...(isDrawing(caption) ? ['is-drawing'] : []),
          ],
          id: `fig-${key}`,
          dataAnchor: anchorId,
          dataKey: key,
          ...(target === 'web'
            ? {
                dataCaption: caption?.caption ?? '',
                dataCredit: caption?.credit ?? '',
                dataAvif: src.avif,
                dataWebp: src.webp,
                dataSrc: src.fallback,
                dataW: String(src.width),
                dataH: String(src.height),
                dataLqip: src.lqip,
              }
            : {}),
        },
        [body, figcaption.length ? el('figcaption', {}, figcaption) : null].filter(Boolean),
      );

      return figure;
    }
  };
}

export default rehypeAnchorImages;
