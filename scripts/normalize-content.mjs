/**
 * Normalizes the original book sources into an Astro content collection.
 *
 * Reads the untouched originals from source/content-original/ and writes
 * slugged files with typed frontmatter into src/content/book/. The body text
 * is preserved verbatim except for three passes:
 *
 *   1. Leading headings promoted to frontmatter are dropped (see `strip`).
 *   2. Heading lines lose their markdown emphasis — the design system sets
 *      every heading in Oswald 700 uppercase, so `**` inside one is noise
 *      that would also pollute the generated anchor id.
 *   3. A short, explicit list of transcription errors is corrected.
 *
 * Also emits src/data/headings.json: every heading in the book with the exact
 * anchor id Astro will generate for it. The image map keys on those ids, so
 * both sides have to agree — hence the shared github-slugger instance.
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import Slugger from 'github-slugger';
import { ENTRIES, SECTIONS } from './manifest.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'source', 'content-original');
const OUT = path.join(ROOT, 'src', 'content', 'book');
const DATA = path.join(ROOT, 'src', 'data');

/**
 * Transcription errors corrected during normalization, keyed by source file.
 * Every entry is a literal find/replace so the diff stays auditable — nothing
 * here is a regex, and nothing rewrites the author's prose.
 */
const FIXES = {
  'section05-juicio-y-castigo/22.PARTES Y PENAS.md': [
    {
      // "Tribunal" was split across the heading and the paragraph below it.
      from: '## CAUSA BRIGADA IITribun\n\nal: Eduardo Belforte',
      to: '## CAUSA BRIGADA II\n\nTribunal: Eduardo Belforte',
    },
  ],
};

/** Strips markdown emphasis from a heading line and collapses its whitespace. */
function cleanHeading(line) {
  const match = /^(#{1,6})\s+(.*)$/.exec(line);
  if (!match) return line;
  const [, hashes, rawText] = match;
  const text = rawText
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
  return `${hashes} ${text}`;
}

/** Removes the first `count` heading lines, plus the blank lines they leave. */
function stripLeadingHeadings(lines, count) {
  if (!count) return lines;
  let removed = 0;
  let i = 0;
  while (i < lines.length && removed < count) {
    const line = lines[i];
    if (/^#{1,6}\s+/.test(line)) {
      lines[i] = null;
      removed += 1;
    } else if (line.trim() !== '') {
      // Hit body text before finding every heading — stop rather than eat prose.
      break;
    }
    i += 1;
  }
  return lines.filter((line) => line !== null);
}

function escapeYaml(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const slugger = new Slugger();
const headingIndex = [];
let totalWords = 0;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await mkdir(DATA, { recursive: true });

for (const [index, entry] of ENTRIES.entries()) {
  const sourcePath = path.join(SRC, entry.source);
  if (!existsSync(sourcePath)) {
    throw new Error(`Falta el archivo de origen: ${entry.source}`);
  }

  let raw = await readFile(sourcePath, 'utf8');

  for (const fix of FIXES[entry.source] ?? []) {
    if (!raw.includes(fix.from)) {
      throw new Error(`La corrección ya no coincide en ${entry.source}: ${fix.from.slice(0, 40)}…`);
    }
    raw = raw.replace(fix.from, fix.to);
  }

  let lines = raw.replace(/\r\n/g, '\n').split('\n').map(cleanHeading);
  lines = stripLeadingHeadings(lines, entry.strip);

  const body = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // Anchor ids must be unique per rendered page, so the slugger resets per file
  // exactly the way Astro's does.
  slugger.reset();
  const headings = [];
  let inFence = false;
  let current = null;
  let inBlock = false;

  for (const line of body.split('\n')) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) continue;

    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match) {
      const text = match[2].trim();
      // `blocks` counts the paragraphs and quotes that follow a heading before
      // the next one. The image map reads it as capacity: a heading carrying
      // twenty paragraphs can hold a sequence of photographs, one carrying two
      // cannot.
      current = { depth: match[1].length, text, slug: slugger.slug(text), blocks: 0 };
      headings.push(current);
      inBlock = false;
      continue;
    }

    const blank = line.trim() === '';
    if (blank) {
      inBlock = false;
    } else if (!inBlock) {
      inBlock = true;
      if (current) current.blocks += 1;
    }
  }

  const words = body.split(/\s+/).filter(Boolean).length;
  totalWords += words;

  const section = SECTIONS.find((s) => s.id === entry.section);
  if (!section) throw new Error(`Sección desconocida: ${entry.section}`);

  headingIndex.push({
    slug: entry.slug,
    title: entry.title,
    section: entry.section,
    order: index,
    pageType: entry.pageType,
    headings,
  });

  const frontmatter = [
    '---',
    `title: ${escapeYaml(entry.title)}`,
    `docSlug: ${escapeYaml(entry.slug)}`,
    `order: ${index}`,
    `section: ${escapeYaml(entry.section)}`,
    `pageType: ${escapeYaml(entry.pageType)}`,
    `words: ${words}`,
    `sourceFile: ${escapeYaml(entry.source)}`,
    '---',
    '',
  ].join('\n');

  await writeFile(path.join(OUT, `${String(index).padStart(2, '0')}-${entry.slug}.md`), `${frontmatter}${body}\n`, 'utf8');
}

await writeFile(
  path.join(DATA, 'headings.json'),
  `${JSON.stringify({ sections: SECTIONS, entries: headingIndex }, null, 2)}\n`,
  'utf8',
);

const headingCount = headingIndex.reduce((sum, e) => sum + e.headings.length, 0);
console.log(`Normalizados ${ENTRIES.length} archivos → src/content/book/`);
console.log(`  ${totalWords.toLocaleString('es-AR')} palabras, ${headingCount} títulos indexados`);
console.log(`  Índice de títulos → src/data/headings.json`);
