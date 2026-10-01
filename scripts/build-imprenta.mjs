/**
 * Builds the print-shop PDF from the published A5 PDF.
 *
 * The download stays exactly as it is: A5, no marks. This is a second file,
 * written under build/ (never published), for the printer:
 *
 *   · every page sits on a larger MediaBox: the A5 trim plus 3 mm of bleed and
 *     10 mm of slug on every side, where the crop marks live;
 *   · TrimBox is the A5 page, BleedBox the trim plus 3 mm;
 *   · crop marks at the four trim corners, outside the bleed, 0.25 pt, in
 *     registration black (100 % of every ink);
 *   · blank courtesy pages are added at the end until the total is a multiple
 *     of 16, the usual signature of an offset press (A5 on a 16-page sheet).
 *
 * The page content is placed, not scaled. The book has no tinted background and
 * no image runs off the page, so the bleed area is paper white; if a future
 * edition adds full-bleed art it has to extend itself into it.
 *
 *   npm run pdf && npm run pdf:imprenta
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, PDFName, PDFNumber, PDFArray, cmyk } from 'pdf-lib';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'public', 'descargas', 'juicio-y-castigo-en-el-chaco-vol-2.pdf');
const OUT_DIR = path.join(ROOT, 'build', 'imprenta');
const OUT = path.join(OUT_DIR, 'juicio-y-castigo-en-el-chaco-vol-2-imprenta.pdf');

const MM = 72 / 25.4;
const BLEED = 3 * MM;
const SLUG = 10 * MM;
const MARK_GAP = BLEED + 1 * MM; // marks start 1 mm clear of the bleed
const MARK_LEN = SLUG - MARK_GAP - 1 * MM;
/** Pages per signature the total is rounded up to. */
const SIGNATURE = 16;

const source = await PDFDocument.load(await readFile(SRC));
const sourcePages = source.getPages();
const { width: W, height: H } = sourcePages[0].getSize();
const margin = BLEED + SLUG;
const pageW = W + 2 * margin;
const pageH = H + 2 * margin;

const out = await PDFDocument.create();
const embedded = await out.embedPages(sourcePages);
const total = Math.ceil(sourcePages.length / SIGNATURE) * SIGNATURE;

const box = (page, name, x, y, w, h) => {
  const arr = PDFArray.withContext(out.context);
  for (const n of [x, y, x + w, y + h]) arr.push(PDFNumber.of(n));
  page.node.set(PDFName.of(name), arr);
};

for (let i = 0; i < total; i += 1) {
  const page = out.addPage([pageW, pageH]);
  if (embedded[i]) page.drawPage(embedded[i], { x: margin, y: margin, width: W, height: H });

  box(page, 'TrimBox', margin, margin, W, H);
  box(page, 'BleedBox', margin - BLEED, margin - BLEED, W + 2 * BLEED, H + 2 * BLEED);

  const black = cmyk(1, 1, 1, 1);
  const line = (x1, y1, x2, y2) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.25, color: black });
  for (const x of [margin, margin + W]) {
    const dir = x === margin ? -1 : 1;
    for (const y of [margin, margin + H]) {
      const vdir = y === margin ? -1 : 1;
      // horizontal mark, running out from the corner along the trim line
      line(x + dir * MARK_GAP, y, x + dir * (MARK_GAP + MARK_LEN), y);
      // vertical mark
      line(x, y + vdir * MARK_GAP, x, y + vdir * (MARK_GAP + MARK_LEN));
    }
  }
}

out.setTitle('Juicio y Castigo en el Chaco (Vol II) — edición para imprenta');
await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, await out.save({ useObjectStreams: true }));
console.log(
  `Imprenta → ${path.relative(ROOT, OUT)}: ${sourcePages.length} páginas + ${total - sourcePages.length} blancas = ${total} (múltiplo de ${SIGNATURE}); ` +
    `hoja ${(pageW / MM).toFixed(0)} × ${(pageH / MM).toFixed(0)} mm, corte A5, sangrado 3 mm`,
);
