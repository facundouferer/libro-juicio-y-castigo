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
const placed = new Set([
  ...Object.values(imageMap.anchors ?? {}).flatMap((doc) => Object.values(doc).flat()),
  ...Object.values(imageMap.document ?? {}),
  ...Object.values(imageMap.galleries ?? {}).flat(),
]);
const unplaced = captions.images.map((c) => c.key).filter((key) => !placed.has(key));

console.log(`Referencias a assets verificadas: ${references} (${checked.size} archivos distintos)`);
console.log(`Imágenes del libro ubicadas: ${placed.size} de ${captions.images.length}`);

let failed = false;

if (missing.size) {
  failed = true;
  console.error(`\nFALTAN ${missing.size} archivos:`);
  for (const item of [...missing].slice(0, 40)) console.error(`  ${item}`);
}

if (unplaced.length) {
  failed = true;
  console.error(`\nImágenes sin ubicar en el libro (${unplaced.length}): ${unplaced.join(', ')}`);
}

if (failed) process.exit(1);
console.log('\nTodo en su lugar.');
