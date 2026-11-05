/**
 * Renders every page of the published PDF to an image for the 3D book (/libro).
 *
 * The browser never opens the PDF: each page is a JPEG the scene loads only
 * when its spread comes near. Like every other derivative, the images are
 * committed, so CI needs no PDF renderer.
 *
 * Requires `pdftoppm` (poppler). Run after `npm run pdf`:
 *   npm run pages
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDF = path.join(ROOT, 'public', 'descargas', 'juicio-y-castigo-en-el-chaco-vol-2.pdf');
const OUT = path.join(ROOT, 'public', 'img', 'libro');
const MANIFEST = path.join(ROOT, 'src', 'data', 'libro-pages.json');
/** Tall enough to read two A5 pages on a desktop screen, small enough to stream. */
const HEIGHT = 1400;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

execFileSync('pdftoppm', [
  '-jpeg',
  '-jpegopt', 'quality=78,progressive=y',
  '-scale-to-x', '-1',
  '-scale-to-y', String(HEIGHT),
  PDF,
  path.join(OUT, 'p'),
]);

// pdftoppm pads the page number to the width of the page count (p-001.jpg).
const files = (await readdir(OUT)).filter((f) => f.endsWith('.jpg')).sort();
await writeFile(
  MANIFEST,
  `${JSON.stringify({ count: files.length, height: HEIGHT, aspect: 420 / 594.96, files }, null, 2)}\n`,
  'utf8',
);
console.log(`Páginas del libro 3D: ${files.length} → public/img/libro/`);
