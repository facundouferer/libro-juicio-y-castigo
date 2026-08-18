/**
 * Renders the book outside Astro, for the PDF and the EPUB.
 *
 * Mirrors the site's markdown pipeline — same parser, same heading slugs, same
 * image-anchoring plugin — so a photograph sits beside the same paragraph in
 * all three editions. The only difference is what the plugin emits for an
 * image, which each target needs in its own shape.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { rehypeAnchorImages } from '../../src/lib/rehype-anchor-images.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOOK_DIR = path.join(ROOT, 'src', 'content', 'book');

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
    .use(rehypeStringify, { allowDangerousHtml: true });

  const files = (await readdir(BOOK_DIR)).filter((f) => f.endsWith('.md')).sort();
  const documents = [];

  for (const file of files) {
    const raw = await readFile(path.join(BOOK_DIR, file), 'utf8');
    const { data, content } = matter(raw);

    const vfile = await processor.process({ value: content, data: { frontmatter: data } });
    const html = String(vfile);

    // Re-derive the heading list from the rendered HTML so the PDF outline and
    // the EPUB navigation use exactly the ids the anchors point at.
    const headings = [...html.matchAll(/<h([1-4]) id="([^"]+)"[^>]*>(.*?)<\/h\1>/gs)].map((m) => ({
      depth: Number(m[1]),
      id: m[2],
      text: m[3].replace(/<[^>]+>/g, '').trim(),
    }));

    documents.push({ file, data, html, headings });
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
