/**
 * Post-build check.
 *
 * The site references image derivatives by filename, and those filenames are
 * produced by a separate script whose output is committed rather than rebuilt
 * in CI. Nothing in the type system connects the two, so a renamed or missing
 * derivative would ship as a broken image and only be noticed by a reader.
 *
 * This resolves every asset the built HTML asks for against dist/ and fails
 * the build if any of them is absent.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ACCENT_HUE, contrastReport } from '../src/lib/palette.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

if (!existsSync(DIST)) {
  console.error('No existe dist/. Corré primero: npm run build');
  process.exit(1);
}

/** Every .html under dist/, at any depth. */
async function pages(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await pages(full)));
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

const base = (process.env.SITE_BASE ?? '/juicio-y-castigo-chaco').replace(/\/+$/, '');
const missing = new Set();
const checked = new Set();
let references = 0;

for (const page of await pages(DIST)) {
  const html = await readFile(page, 'utf8');

  // src, srcset and href entries pointing at our own static assets.
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) urls.add(match[1]);
  for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const candidate of match[1].split(',')) urls.add(candidate.trim().split(/\s+/)[0]);
  }

  for (const url of urls) {
    if (!url.startsWith('/')) continue;
    if (url.startsWith('//')) continue;
    // Only the assets this build owns; anchors and generated routes are not files.
    if (!/\.(avif|webp|png|jpe?g|svg|css|js|pdf|epub|json)$/i.test(url)) continue;

    references += 1;
    const relative = base && url.startsWith(`${base}/`) ? url.slice(base.length) : url;
    const file = path.join(DIST, decodeURIComponent(relative));
    if (checked.has(file)) continue;
    checked.add(file);
    if (!existsSync(file)) missing.add(`${url}   (referenciado en ${path.relative(DIST, page)})`);
  }
}

// The map has to have placed every photograph — an image the mapping dropped
// would simply never appear, silently.
const imageMap = JSON.parse(await readFile(path.join(ROOT, 'src', 'data', 'image-map.json'), 'utf8'));
const captions = JSON.parse(await readFile(path.join(ROOT, 'src', 'data', 'captions.json'), 'utf8'));
const headings = JSON.parse(await readFile(path.join(ROOT, 'src', 'data', 'headings.json'), 'utf8'));

/**
 * Every placement, walked in the order a reader meets it: document by document,
 * heading by heading. This is the sequence spec 04 constrains, so it is the
 * sequence that has to be checked — not the order the JSON happens to list.
 */
const sequence = [];
for (const entry of headings.entries) {
  const documentImage = imageMap.document?.[entry.slug];
  if (documentImage) sequence.push({ key: documentImage, where: `${entry.slug} (documento)` });
  const anchors = imageMap.anchors?.[entry.slug] ?? {};
  for (const heading of entry.headings) {
    for (const key of anchors[heading.slug] ?? []) {
      sequence.push({ key, where: `${entry.slug}#${heading.slug}` });
    }
  }
}

const skipped = new Set((imageMap.skipped ?? []).map((s) => s.key));
const placed = new Set(sequence.map((s) => s.key));
const unplaced = captions.images.map((c) => c.key).filter((key) => !placed.has(key) && !skipped.has(key));

// The folder numbering is the book's visual score (spec 04, RF-04.1). Reading
// order has to walk it forwards, or the narrative sequence is broken again.
const folderRank = new Map(captions.images.map((c, i) => [c.key, i]));
const regressions = [];
for (let i = 1; i < sequence.length; i += 1) {
  const previous = folderRank.get(sequence[i - 1].key);
  const current = folderRank.get(sequence[i].key);
  if (previous !== undefined && current !== undefined && current < previous) {
    regressions.push(`${sequence[i].key} aparece después de ${sequence[i - 1].key} (${sequence[i].where})`);
  }
}

// No photograph may appear twice, not even filling a courtesy blank (RF-04.5).
const seen = new Map();
const repeated = [];
for (const item of sequence) {
  if (seen.has(item.key)) repeated.push(`${item.key}: ${seen.get(item.key)} y ${item.where}`);
  else seen.set(item.key, item.where);
}

// Editorial material the book still needs. Not a failure: the structure is in
// place and the text is the editorial team's to supply (spec 01, RF-01.4).
const pending = headings.entries.filter((entry) => entry.pending?.length);

console.log(`Referencias a assets verificadas: ${references} (${checked.size} archivos distintos)`);
console.log(`Imágenes del libro ubicadas: ${placed.size} de ${captions.images.length}`);
if (skipped.size) console.log(`Descartadas por decisión editorial: ${skipped.size}`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
console.log(`Secuencia en orden de carpeta: ${regressions.length ? plural(regressions.length, 'salto hacia atrás', 'saltos hacia atrás') : 'sí'}`);

let failed = false;

if (regressions.length) {
  failed = true;
  console.error(`\nLa secuencia de imágenes retrocede en ${plural(regressions.length, 'punto', 'puntos')} (spec 04, RF-04.3):`);
  for (const item of regressions.slice(0, 20)) console.error(`  ${item}`);
}

if (repeated.length) {
  failed = true;
  console.error(`\n${plural(repeated.length, 'Imagen repetida', 'Imágenes repetidas')} (spec 04, RF-04.5):`);
  for (const item of repeated) console.error(`  ${item}`);
}

if (missing.size) {
  failed = true;
  console.error(`\nFALTAN ${missing.size} archivos:`);
  for (const item of [...missing].slice(0, 40)) console.error(`  ${item}`);
}

if (unplaced.length) {
  failed = true;
  console.error(`\nImágenes sin ubicar en el libro (${unplaced.length}): ${unplaced.join(', ')}`);
}

// The contrast guarantee is recorded, not assumed (spec 07, CA-07.4).
const contrast = contrastReport();
console.log(`Paleta: matiz ${ACCENT_HUE}°, ${contrast.length} intensidades en uso`);
for (const step of contrast) {
  console.log(`  paso ${step.step}  ${step.hex}  ${String(step.ratio).padStart(5)}:1  ${step.bodySafe ? 'AA cuerpo' : 'AA titulación y filetes'}`);
}
const failing = contrast.filter((step) => !step.ok);
if (failing.length) {
  failed = true;
  console.error(`\nPasos de la paleta por debajo de 3:1 (spec 07, RF-07.4): ${failing.map((s) => s.step).join(', ')}`);
}

if (pending.length) {
  console.log('\nPendiente del equipo editorial:');
  for (const entry of pending) console.log(`  ${entry.title}: ${entry.pending.join(', ')}`);
}

if (failed) process.exit(1);
console.log('\nTodo en su lugar.');
