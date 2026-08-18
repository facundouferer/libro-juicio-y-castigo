/**
 * Records the real size of the downloadable editions.
 *
 * The download panel tells the reader what they are about to pull down before
 * they tap it — which matters most on the phone connection this book is likely
 * to be read on. Those numbers have to come from the files themselves, so this
 * runs after build-pdf and build-epub and rewrites src/data/downloads.json.
 *
 * A file that has not been built yet keeps `bytes: 0`, and the panel says so
 * rather than advertising a download that would 404.
 */

import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'data', 'downloads.json');
const PUBLIC = path.join(ROOT, 'public');

const manifest = JSON.parse(await readFile(DATA, 'utf8'));

for (const file of manifest.files) {
  const full = path.join(PUBLIC, file.path);
  if (!existsSync(full)) {
    file.bytes = 0;
    file.pages = 0;
    console.log(`  ${file.format}: sin generar`);
    continue;
  }

  const info = await stat(full);
  file.bytes = info.size;

  if (file.format === 'PDF') {
    const pdf = await PDFDocument.load(await readFile(full), { updateMetadata: false });
    file.pages = pdf.getPageCount();
  }

  const mb = (info.size / 1024 / 1024).toFixed(1);
  console.log(`  ${file.format}: ${mb} MB${file.pages ? ` · ${file.pages} páginas` : ''}`);
}

await writeFile(DATA, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`\nManifiesto de descargas → src/data/downloads.json`);
