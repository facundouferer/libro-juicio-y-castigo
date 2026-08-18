/**
 * Writes the editorial review list for the image anchoring.
 *
 * The anchoring was reconstructed by reading the chronicles: the manuscript
 * itself never said which photograph went with which passage. Every anchor
 * carries the confidence of the reading that produced it, and this turns the
 * uncertain ones into a document someone at the CPM can work through.
 *
 * Least certain first, because that is the order in which a limited amount of
 * editorial attention should be spent.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'data');
const OUT = path.join(ROOT, 'build', 'revision-imagenes.md');

const map = JSON.parse(await readFile(path.join(DATA, 'image-map.json'), 'utf8'));
const captions = JSON.parse(await readFile(path.join(DATA, 'captions.json'), 'utf8'));
const { entries } = JSON.parse(await readFile(path.join(DATA, 'headings.json'), 'utf8'));

const fileByKey = new Map(captions.images.map((c) => [c.key, c.file]));
const titleByDoc = new Map(entries.map((e) => [e.slug, e.title]));

const review = map.review ?? [];
const total = captions.images.length;

const band = (confidence) => {
  if (confidence >= 70) return 'Reubicada';
  if (confidence >= 40) return 'Dudosa';
  return 'Muy dudosa';
};

const lines = [
  '# Revisión de los anclajes de imagen',
  '',
  `El manuscrito no traía ninguna referencia a imágenes: las ${total} fotografías y los ${entries.reduce((n, e) => n + e.headings.length, 0)} títulos`,
  'eran dos listas separadas. El anclaje se reconstruyó leyendo las crónicas y cruzando cada',
  'epígrafe con el pasaje que lo menciona.',
  '',
  `Este documento lista los **${review.length} anclajes que conviene revisar**, de menos a más confiable.`,
  `Los otros ${total - review.length} se apoyan en una coincidencia literal — un nombre, una fecha, una frase del`,
  'testimonio — que aparece tanto en el epígrafe como en el texto.',
  '',
  '## Cómo corregir uno',
  '',
  '1. Buscá la imagen por su clave en `scripts/proposed-anchors.json`.',
  '2. Cambiá `documentSlug` y `headingSlug` por el título correcto',
  '   (el listado completo está en `src/data/heading-index.md`).',
  '3. Subí `confidence` a 90 y escribí en `reasoning` por qué.',
  '4. Corré `npm run map` y después `npm run build`.',
  '',
  '---',
  '',
];

let currentBand = null;
for (const item of review) {
  const label = band(item.confidence);
  if (label !== currentBand) {
    currentBand = label;
    lines.push(`## ${label}`, '');
  }

  const file = fileByKey.get(item.key) ?? '';
  lines.push(`### \`${item.key}\` — confianza ${item.confidence}`);
  lines.push('');
  lines.push(`**Epígrafe:** ${item.caption || '_(el archivo no le puso epígrafe)_'}`);
  lines.push('');
  lines.push(`**Archivo:** \`${file}\``);
  lines.push('');
  if (item.docSlug) {
    lines.push(`**Anclada en:** ${titleByDoc.get(item.docSlug) ?? item.docSlug} → ${item.heading}`);
  } else {
    lines.push('**Anclada en:** _sin ubicar_');
  }
  lines.push('');
  lines.push(`**Por qué:** ${item.reasoning}`);
  lines.push('');
}

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, `${lines.join('\n')}\n`, 'utf8');

const counts = review.reduce((acc, item) => {
  const label = band(item.confidence);
  acc[label] = (acc[label] ?? 0) + 1;
  return acc;
}, {});

console.log(`Imágenes ancladas: ${total}`);
console.log(`Para revisar: ${review.length}`);
for (const [label, n] of Object.entries(counts)) console.log(`  ${label.padEnd(12)} ${n}`);
console.log(`\nInforme → ${path.relative(ROOT, OUT)}`);
