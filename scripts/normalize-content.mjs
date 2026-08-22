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
 *   4. The manuscript's footnote convention becomes markup (see markFootnotes).
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
import { isVolanta } from '../src/lib/cronicas.mjs';

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

const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * The manuscript marks its footnotes with an all-emphasis line — ***NOTAS PIE
 * DE PÁGINA*** — followed by one ***N …*** paragraph per note. Rendered as
 * written, they came out at body size in bold italic, which is exactly what the
 * editorial pass flagged (spec 02, RF-02.6).
 *
 * The emphasis is an authoring convention, not a design decision, so it is
 * translated here into markup the three editions can style as notes. The `***`
 * pattern is left alone everywhere else: the same marks are used as legitimate
 * emphasis inside the chronicles, and restyling them all would be wrong.
 */
function markFootnotes(body) {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => /^\s*\*\*\*\s*NOTAS?\b[^*]*\*\*\*\s*$/i.test(line));
  if (start === -1) return body;

  const notes = [];
  let end = start + 1;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = /^\*\*\*(.+)\*\*\*$/.exec(line);
    if (!match) break;
    notes.push(match[1].trim());
    end = i + 1;
  }
  if (!notes.length) return body;

  const block = [
    '<aside class="footnotes" aria-label="Notas al pie">',
    '<p class="footnotes-title">Notas al pie</p>',
    ...notes.map((note) => `<p>${escapeHtml(note)}</p>`),
    '</aside>',
  ].join('\n');

  return [...lines.slice(0, start), block, ...lines.slice(end)].join('\n');
}

/** The little inline markdown a signature block uses, and nothing else. */
function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

/**
 * Moves a text's signature out of the body.
 *
 * Both texts of the front matter signed themselves at the foot, so a reader
 * only learned whose voice it was after finishing. The signature now opens the
 * text as a `byline` declared in the manifest; what stays at the foot is what
 * is information rather than signature — the roll of organisations, the date —
 * set as a note and never repeating the name (specs-v12, spec 02, RF-02.4).
 */
function moveSignoff(body, signoff) {
  if (!signoff) return body;

  let lines = body.split('\n');
  for (const drop of signoff.drop ?? []) {
    const at = lines.findIndex((line) => line.trim() === drop.trim());
    if (at === -1) throw new Error(`La firma ya no coincide: ${drop.slice(0, 48)}…`);
    lines.splice(at, 1);
  }

  const start = lines.findIndex((line) => line.trim().startsWith(signoff.start.trim()));
  if (start === -1) throw new Error(`No encuentro el pie de firma: ${signoff.start.slice(0, 48)}…`);

  const tail = lines
    .slice(start)
    .map((line) => line.trim())
    .filter(Boolean);

  const block = [
    '<aside class="signoff">',
    ...(signoff.lead ? [`<p class="signoff-lead">${inlineMarkdown(signoff.lead)}</p>`] : []),
    ...tail.map((line) => `<p>${inlineMarkdown(line)}</p>`),
    '</aside>',
  ].join('\n');

  return [...lines.slice(0, start), block].join('\n').replace(/\n{3,}/g, '\n\n').trim();
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

  const body = moveSignoff(
    markFootnotes(lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()),
    entry.signoff,
  );

  // Anchor ids must be unique per rendered page, so the slugger resets per file
  // exactly the way Astro's does.
  slugger.reset();
  const headings = [];
  let inFence = false;
  let current = null;
  let inBlock = false;
  /** Whether the previous non-blank line was a heading — see the role below. */
  let lastWasHeading = false;

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
      const depth = match[1].length;
      const slug = slugger.slug(text);
      // A volanta is not a title: it introduces one. Marking the role here is
      // what lets the contents panel, the PDF outline and the EPUB navigation
      // list headlines instead of 34 lines reading «CAUSA BRIGADA I …»
      // (specs-v12, spec 04, RF-04.5).
      const volanta = isVolanta(depth, text, slug);
      current = { depth, text, slug, blocks: 0, ...(volanta ? { role: 'volanta' } : {}) };
      // The headline is the h2 immediately after a volanta — nothing but the
      // heading line itself may come between them.
      if (depth === 2 && headings.at(-1)?.role === 'volanta' && lastWasHeading) {
        current.role = 'title';
      }
      headings.push(current);
      inBlock = false;
      lastWasHeading = true;
      continue;
    }

    const blank = line.trim() === '';
    if (blank) {
      inBlock = false;
    } else if (!inBlock) {
      inBlock = true;
      lastWasHeading = false;
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
    showTitle: entry.showTitle !== false,
    ...(entry.kicker ? { kicker: entry.kicker } : {}),
    ...(entry.byline ? { byline: entry.byline } : {}),
    ...(entry.pending?.length ? { pending: entry.pending } : {}),
    headings,
  });

  const frontmatter = [
    '---',
    `title: ${escapeYaml(entry.title)}`,
    `docSlug: ${escapeYaml(entry.slug)}`,
    `order: ${index}`,
    `section: ${escapeYaml(entry.section)}`,
    `pageType: ${escapeYaml(entry.pageType)}`,
    ...(entry.showTitle === false ? ['showTitle: false'] : []),
    ...(entry.kicker ? [`kicker: ${escapeYaml(entry.kicker)}`] : []),
    ...(entry.byline ? [`byline: ${escapeYaml(entry.byline)}`] : []),
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
