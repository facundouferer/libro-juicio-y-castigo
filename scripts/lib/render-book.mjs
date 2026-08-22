/**
 * Renders the book outside Astro, for the PDF and the EPUB.
 *
 * Mirrors the site's markdown pipeline — same parser, same heading slugs, same
 * image-anchoring plugin — so a photograph sits beside the same paragraph in
 * all three editions. The only difference is what the plugin emits for an
 * image, which each target needs in its own shape.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { rehypeAnchorImages } from '../../src/lib/rehype-anchor-images.mjs';
import { rehypeCronicaHeads } from '../../src/lib/rehype-cronica-heads.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOOK_DIR = path.join(ROOT, 'src', 'content', 'book');

function loadJson(relative, fallback) {
  const file = path.join(ROOT, relative);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;
}

/**
 * Openings, interludes and documents without headings of their own carry one
 * photograph for the whole document. On the site the layouts render it; out
 * here nothing did, so ten photographs were reaching the reader on screen and
 * silently missing from the PDF and the EPUB (spec 04, RF-04.6).
 */
function documentImages() {
  const map = loadJson('src/data/image-map.json', { document: {} });
  const images = loadJson('src/data/images.json', { content: {} });
  const captions = loadJson('src/data/captions.json', { images: [] });
  const captionByKey = new Map(captions.images.map((c) => [c.key, c]));

  const out = new Map();
  for (const [docSlug, key] of Object.entries(map.document ?? {})) {
    const entry = images.content?.[key];
    if (!entry) continue;
    const caption = captionByKey.get(key);
    out.set(docSlug, {
      key,
      width: entry.width,
      height: entry.height,
      orientation: entry.orientation ?? 'landscape',
      quality: entry.printQuality ?? 'full',
      alt: caption?.caption ?? '',
      caption: caption?.caption ?? '',
      credit: caption?.credit ?? '',
    });
  }
  return out;
}

/** @param {'print'|'epub'} target */
export async function renderBook(target) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeAnchorImages, {
      target,
      // gray-matter hands the frontmatter over directly; there is no Astro
      // vfile to read it from out here.
      frontmatterOf: (file) => file.data.frontmatter,
    })
    // After the anchoring, which needs the plain heading tree: this pass folds
    // each volanta and its headline into one header and takes the volanta out
    // of the heading sequence (specs-v12, spec 04).
    .use(rehypeCronicaHeads)
    .use(rehypeStringify, { allowDangerousHtml: true });

  const files = (await readdir(BOOK_DIR)).filter((f) => f.endsWith('.md')).sort();
  const plates = documentImages();
  const documents = [];

  for (const file of files) {
    const raw = await readFile(path.join(BOOK_DIR, file), 'utf8');
    const { data, content } = matter(raw);

    const vfile = await processor.process({ value: content, data: { frontmatter: data } });
    const html = String(vfile);

    // Re-derive the heading list from the rendered HTML so the PDF outline and
    // the EPUB navigation use exactly the ids the anchors point at.
    // Attribute order is not guaranteed — `cronica-title` carries its class
    // first — so the id is matched wherever it sits in the tag.
    const headings = [...html.matchAll(/<h([1-4])\s([^>]*)>(.*?)<\/h\1>/gs)]
      .map((m) => ({
        depth: Number(m[1]),
        id: /\bid="([^"]+)"/.exec(m[2])?.[1] ?? '',
        cronica: /\bclass="[^"]*\bcronica-title\b/.test(m[2]),
        text: m[3].replace(/<[^>]+>/g, '').trim(),
      }))
      .filter((h) => h.id);

    documents.push({ file, data, html, headings, plate: plates.get(data.docSlug) ?? null });
  }

  documents.sort((a, b) => a.data.order - b.data.order);
  return documents;
}

/** Escapes text for inclusion in XML/XHTML — the EPUB container is strict. */
export function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
