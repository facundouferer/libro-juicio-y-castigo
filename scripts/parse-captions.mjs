/**
 * Parses src/content/epigrafes-images-contenido.md into structured captions and
 * binds each one to a real file in src/images/content/.
 *
 * The source file was written by hand over years, so the identifiers drift:
 * `IMG\_031`, `IMG_31`, `IMG\_ 32\)`, `Img\_050`, `IMG \-099\_)`. Some entries
 * carry a short label before the caption ("IMG\_061 Chachi) Gregorio…") and
 * some run straight into it ("IMG\_064 La Brigada de Investigaciones…").
 *
 * Both sides are reduced to the same key — the image number plus how many times
 * "bis" is repeated — and anything that fails to bind is reported rather than
 * guessed at.
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CAPTIONS_MD = path.join(ROOT, 'source', 'content-original', 'epigrafes-images-contenido.md');
const IMAGES_DIR = path.join(ROOT, 'src', 'images', 'content');
const DATA = path.join(ROOT, 'src', 'data');

/** Longest label accepted before a `)` — anything longer is caption prose. */
const MAX_LABEL = 32;

/** Reduces either an identifier or a filename to `NNN` / `NNNbis` / `NNNbisbis`. */
function keyOf(number, bisCount) {
  return `${String(number).padStart(3, '0')}${'bis'.repeat(bisCount)}`;
}

function unescapeMarkdown(text) {
  return text
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits a caption's trailing "/ Prensa CPM" style attribution from its text. */
function splitCredit(caption) {
  // A dangling slash means the author opened an attribution and left it empty.
  const cleaned = caption.replace(/[\s/]+$/, '').trim();
  const match = /^(.*?)[\s]*\/[\s]*([^/]{2,60})$/s.exec(cleaned);
  if (!match) return { text: cleaned, credit: null };
  const [, text, credit] = match;
  // A slash inside a date range or a page reference is not an attribution.
  if (/\d\s*$/.test(text) && /^\d/.test(credit)) return { text: cleaned, credit: null };
  return { text: text.trim().replace(/[,;]$/, ''), credit: credit.trim().replace(/[.,;]$/, '') };
}

const raw = await readFile(CAPTIONS_MD, 'utf8');
const captions = [];
const unparsed = [];

for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || !/img/i.test(trimmed)) continue;

  // Opening paren is optional; separators between "IMG" and the number are
  // any mix of backslash, underscore, hyphen and space.
  const head = /^\(?\s*img\s*[\\_\-\s]*(\d{1,3})\s*((?:\\?_?\s*bis\s*){0,2})/i.exec(trimmed);
  if (!head) {
    unparsed.push(trimmed);
    continue;
  }

  const number = Number(head[1]);
  const bisCount = (head[2].match(/bis/gi) ?? []).length;
  let rest = trimmed.slice(head[0].length);

  // Drop the leftover separators the identifier trailed off with.
  rest = rest.replace(/^[\\_\-\s]+/, '');

  // A short fragment before `)` is the author's shorthand label, not caption
  // text — cut it. A long one, or one containing a comma, is already the caption.
  const paren = rest.indexOf(')');
  if (paren !== -1) {
    const candidate = rest.slice(0, paren);
    if (candidate.length <= MAX_LABEL && !candidate.includes(',')) {
      rest = rest.slice(paren + 1);
    } else if (paren === 0) {
      rest = rest.slice(1);
    }
  }

  const caption = unescapeMarkdown(rest).replace(/^[)\s\\_\-]+/, '').trim();
  const { text, credit } = splitCredit(caption);

  captions.push({
    key: keyOf(number, bisCount),
    number,
    bisCount,
    caption: text,
    credit,
    raw: trimmed,
  });
}

// Bind captions to files. Filenames carry the same number, sometimes with a
// "bis" marker in a different position and case than the caption uses.
const files = (await readdir(IMAGES_DIR)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
const byKey = new Map();

for (const file of files) {
  const match = /img[\s_\-]*(\d{1,3})((?:[\s_\-]*bis){0,2})/i.exec(file);
  if (!match) {
    unparsed.push(`ARCHIVO SIN ID: ${file}`);
    continue;
  }
  const bisCount = (match[2].match(/bis/gi) ?? []).length;
  const key = keyOf(Number(match[1]), bisCount);
  if (byKey.has(key)) {
    unparsed.push(`ID DUPLICADO EN ARCHIVOS: ${key} → ${byKey.get(key)} y ${file}`);
    continue;
  }
  byKey.set(key, file);
}

const bound = [];
const captionsWithoutFile = [];

for (const entry of captions) {
  const file = byKey.get(entry.key);
  if (!file) {
    captionsWithoutFile.push(entry);
    continue;
  }
  bound.push({ ...entry, file });
  byKey.delete(entry.key);
}

const filesWithoutCaption = [...byKey.entries()].map(([key, file]) => ({ key, file }));

await mkdir(DATA, { recursive: true });
await writeFile(
  path.join(DATA, 'captions.json'),
  `${JSON.stringify(
    {
      images: bound
        .sort((a, b) => a.number - b.number || a.bisCount - b.bisCount)
        .map(({ raw: _raw, ...rest }) => rest),
      filesWithoutCaption,
      captionsWithoutFile: captionsWithoutFile.map((c) => c.key),
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`Epígrafes parseados: ${captions.length}`);
console.log(`Archivos de imagen:  ${files.length}`);
console.log(`Vinculados:          ${bound.length}`);
if (filesWithoutCaption.length) {
  console.log(`\nImágenes SIN epígrafe (${filesWithoutCaption.length}):`);
  for (const { key, file } of filesWithoutCaption) console.log(`  ${key}  ${file}`);
}
if (captionsWithoutFile.length) {
  console.log(`\nEpígrafes SIN imagen (${captionsWithoutFile.length}):`);
  for (const c of captionsWithoutFile) console.log(`  ${c.key}  ${c.caption.slice(0, 60)}…`);
}
if (unparsed.length) {
  console.log(`\nLíneas no interpretadas (${unparsed.length}):`);
  for (const line of unparsed) console.log(`  ${line.slice(0, 90)}`);
}
