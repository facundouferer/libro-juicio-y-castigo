/**
 * Emits a compact, human- and agent-readable index of every heading in the
 * book, with the exact anchor id the image map has to target.
 *
 * The mapping pass reads this instead of the whole book, so the candidate list
 * stays in view while the prose is fetched on demand.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'data');

const { sections, entries } = JSON.parse(await readFile(path.join(DATA, 'headings.json'), 'utf8'));
const sectionTitle = new Map(sections.map((s) => [s.id, s.title]));

const lines = ['# Índice de títulos del libro', ''];
lines.push('Cada título es un anclaje posible para una imagen. La columna `id` es el');
lines.push('identificador exacto que hay que usar en el mapa de imágenes.', '');

for (const entry of entries) {
  lines.push(`## ${entry.slug}`);
  lines.push(
    `_${entry.title} — sección "${sectionTitle.get(entry.section)}" — ${entry.pageType} — ${entry.headings.length} títulos_`,
  );
  lines.push('');
  if (!entry.headings.length) {
    lines.push('(sin títulos: el texto corre sin subdivisiones)', '');
    continue;
  }
  for (const heading of entry.headings) {
    lines.push(`- h${heading.depth} \`${heading.slug}\` — ${heading.text}`);
  }
  lines.push('');
}

await writeFile(path.join(DATA, 'heading-index.md'), `${lines.join('\n')}\n`, 'utf8');

const total = entries.reduce((sum, e) => sum + e.headings.length, 0);
console.log(`Índice legible → src/data/heading-index.md (${total} títulos en ${entries.length} documentos)`);
