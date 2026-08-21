/**
 * Pre-builds every image derivative the site, the PDF and the EPUB need.
 *
 * The originals are 278 MB of full-resolution scans and press photographs —
 * archival masters that stay in the repository and never reach the browser.
 * Everything published is generated here, ahead of time, and committed.
 *
 * Deriving at build time instead would mean ~600 sharp transforms on every CI
 * run against a GitHub Pages deploy, so the site ships plain <img srcset> over
 * static files and Astro never touches an image.
 *
 * Outputs, all keyed by the image's caption key (`004`, `018bis`, …):
 *   public/img/<set>/<key>-<width>.avif   responsive, primary
 *   public/img/<set>/<key>-<width>.webp   responsive, fallback
 *   public/img/<set>/<key>-lqip.webp      12px blur-up placeholder
 *   build/print/<key>.jpg                 A5 print master for the PDF
 *   build/epub/<key>.jpg                  small, long-edge capped, for the EPUB
 *
 * Re-runs skip work whose output is newer than its source, so this is cheap to
 * call repeatedly.
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'data');

/** Responsive widths served to the browser. */
const AVIF_WIDTHS = [640, 1280, 2048];
/** The fallback ladder stops lower — a browser without AVIF is a rare, old one. */
const WEBP_WIDTHS = [640, 1280];

/**
 * A5 is 148×210 mm. At 300 dpi that is 1748×2480 px, so 1750 px on the long
 * edge is the most any image can use on a full page — anything larger only
 * inflates the PDF.
 */
const PRINT_MAX = 1750;
/** EPUB readers are phones and e-ink; past 1400 px the file grows for nothing. */
const EPUB_MAX = 1400;

const SETS = [
  { id: 'content', dir: path.join(ROOT, 'src', 'images', 'content'), keyed: true },
  { id: 'edificio', dir: path.join(ROOT, 'src', 'edificio'), keyed: false },
];

function keyFromFilename(file) {
  const match = /img[\s_\-]*(\d{1,3})((?:[\s_\-]*bis){0,2})/i.exec(file);
  if (!match) return null;
  const bis = (match[2].match(/bis/gi) ?? []).length;
  return `${String(Number(match[1])).padStart(3, '0')}${'bis'.repeat(bis)}`;
}

function slugFromFilename(file) {
  return path
    .basename(file, path.extname(file))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** True when `out` exists and is newer than `src` — nothing to redo. */
async function isFresh(src, out) {
  if (!existsSync(out)) return false;
  const [a, b] = await Promise.all([stat(src), stat(out)]);
  return b.mtimeMs >= a.mtimeMs;
}

let written = 0;
let skipped = 0;
let bytesOut = 0;

async function emit(pipeline, out, encode) {
  const info = await encode(pipeline).toFile(out);
  bytesOut += info.size;
  written += 1;
  return info;
}

const manifest = {};

for (const set of SETS) {
  const outDir = path.join(ROOT, 'public', 'img', set.id);
  await mkdir(outDir, { recursive: true });
  await mkdir(path.join(ROOT, 'build', 'print'), { recursive: true });
  await mkdir(path.join(ROOT, 'build', 'epub'), { recursive: true });

  const files = (await readdir(set.dir)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  manifest[set.id] = {};

  for (const file of files) {
    const src = path.join(set.dir, file);
    const key = set.keyed ? keyFromFilename(file) : slugFromFilename(file);
    if (!key) throw new Error(`No pude derivar la clave de ${file}`);

    // `.rotate()` with no argument bakes in the EXIF orientation, so a photo
    // shot on a phone never lands sideways in the PDF.
    const base = sharp(src, { failOn: 'none' }).rotate();
    const meta = await base.metadata();
    const width = meta.autoOrient?.width ?? meta.width;
    const height = meta.autoOrient?.height ?? meta.height;
    const longEdge = Math.max(width, height);

    const entry = {
      key,
      source: path.relative(ROOT, src),
      width,
      height,
      aspect: Number((width / height).toFixed(4)),
      orientation: width > height ? 'landscape' : width < height ? 'portrait' : 'square',
      /** Long edge under the A5 300 dpi threshold — flagged for the print layout. */
      printQuality: longEdge >= PRINT_MAX ? 'full' : longEdge >= 900 ? 'reduced' : 'low',
      avif: [],
      webp: [],
    };

    for (const w of AVIF_WIDTHS) {
      if (w > longEdge && w !== AVIF_WIDTHS[0]) continue;
      // The filename has to carry the width actually produced, not the rung of
      // the ladder that was asked for — an image smaller than the rung is not
      // enlarged, and the srcset reads these names back.
      const target = Math.min(w, longEdge);
      const out = path.join(outDir, `${key}-${target}.avif`);
      if (await isFresh(src, out)) {
        skipped += 1;
      } else {
        await emit(base.clone().resize({ width: target, height: target, fit: 'inside', withoutEnlargement: true }), out, (p) =>
          p.avif({ quality: 58, effort: 6 }),
        );
      }
      entry.avif.push(target);
    }

    for (const w of WEBP_WIDTHS) {
      if (w > longEdge && w !== WEBP_WIDTHS[0]) continue;
      const target = Math.min(w, longEdge);
      const out = path.join(outDir, `${key}-${target}.webp`);
      if (await isFresh(src, out)) {
        skipped += 1;
      } else {
        await emit(base.clone().resize({ width: target, height: target, fit: 'inside', withoutEnlargement: true }), out, (p) =>
          p.webp({ quality: 76 }),
        );
      }
      entry.webp.push(target);
    }

    // A 12 px blur-up placeholder, inlined later as a data URI so the plate
    // never flashes empty while the full image streams in.
    const lqipPath = path.join(outDir, `${key}-lqip.webp`);
    if (await isFresh(src, lqipPath)) {
      skipped += 1;
    } else {
      await emit(base.clone().resize({ width: 12, height: 12, fit: 'inside' }), lqipPath, (p) => p.webp({ quality: 40 }));
    }
    entry.lqip = `data:image/webp;base64,${(await readFile(lqipPath)).toString('base64')}`;

    const printOut = path.join(ROOT, 'build', 'print', `${key}.jpg`);
    if (await isFresh(src, printOut)) {
      skipped += 1;
    } else {
      // 4:2:0 chroma costs nothing here — most of these are black-and-white
      // scans and drawings — and takes roughly a quarter off a 300-page PDF
      // that people will download over a phone connection.
      await emit(
        base.clone().resize({ width: PRINT_MAX, height: PRINT_MAX, fit: 'inside', withoutEnlargement: true }),
        printOut,
        (p) => p.jpeg({ quality: 84, chromaSubsampling: '4:2:0', mozjpeg: true }),
      );
    }

    const epubOut = path.join(ROOT, 'build', 'epub', `${key}.jpg`);
    if (await isFresh(src, epubOut)) {
      skipped += 1;
    } else {
      await emit(
        base.clone().resize({ width: EPUB_MAX, height: EPUB_MAX, fit: 'inside', withoutEnlargement: true }),
        epubOut,
        (p) => p.jpeg({ quality: 74, mozjpeg: true }),
      );
    }

    manifest[set.id][key] = entry;
  }
}

/*
 * The cover.
 *
 * It used to be a generated collage. In a book that reconstructs facts proved
 * in court, the image on the front has to be verifiable, so it is now a
 * photograph of the building itself: the facade of the ex Brigada de
 * Investigaciones on Marcelo T. de Alvear, today the Casa por la Memoria
 * (spec 06, RF-06.1 and RF-06.2).
 *
 * It is deliberately not one of the book's 105 images — using one of those
 * would make the same photograph appear twice in the same edition.
 *
 * Full-bleed behind the landing type, so it only needs viewport widths, plus
 * one social crop for the link previews.
 */
const coverSrc = path.join(ROOT, 'src', 'edificio', 'frente de la fachada por marcelo t de alvear.jpg');
const coverDir = path.join(ROOT, 'public', 'img');
for (const w of [960, 1600, 2400]) {
  const out = path.join(coverDir, `tapa-${w}.avif`);
  if (await isFresh(coverSrc, out)) {
    skipped += 1;
    continue;
  }
  await emit(sharp(coverSrc).rotate().resize({ width: w, withoutEnlargement: true }), out, (p) =>
    p.avif({ quality: 62, effort: 6 }),
  );
}
for (const w of [960, 1600]) {
  const out = path.join(coverDir, `tapa-${w}.webp`);
  if (await isFresh(coverSrc, out)) {
    skipped += 1;
    continue;
  }
  await emit(sharp(coverSrc).rotate().resize({ width: w, withoutEnlargement: true }), out, (p) => p.webp({ quality: 80 }));
}

// 1200 × 630 is what the link previews expect; the square original is cropped
// to it rather than letterboxed (spec 06, RF-06.6).
const socialOut = path.join(coverDir, 'tapa-social.jpg');
if (await isFresh(coverSrc, socialOut)) {
  skipped += 1;
} else {
  await emit(
    sharp(coverSrc).rotate().resize({ width: 1200, height: 630, fit: 'cover', position: 'top' }),
    socialOut,
    (p) => p.jpeg({ quality: 82, mozjpeg: true }),
  );
}

// The A5 portadilla carries the same photograph (RF-06.3).
const printCoverOut = path.join(ROOT, 'build', 'print', 'tapa.jpg');
if (await isFresh(coverSrc, printCoverOut)) {
  skipped += 1;
} else {
  await emit(sharp(coverSrc).rotate().resize({ width: 1800, withoutEnlargement: true }), printCoverOut, (p) =>
    p.jpeg({ quality: 88, mozjpeg: true }),
  );
}

// And so does the EPUB, which had no cover image at all and therefore showed no
// thumbnail in any library (RF-06.3).
const epubCoverOut = path.join(ROOT, 'build', 'epub', 'tapa.jpg');
if (await isFresh(coverSrc, epubCoverOut)) {
  skipped += 1;
} else {
  await emit(sharp(coverSrc).rotate().resize({ width: 1400, withoutEnlargement: true }), epubCoverOut, (p) =>
    p.jpeg({ quality: 84, mozjpeg: true }),
  );
}

const logoOut = path.join(coverDir, 'logo.webp');
if (await isFresh(path.join(ROOT, 'src', 'images', 'logo.png'), logoOut)) {
  skipped += 1;
} else {
  await emit(sharp(path.join(ROOT, 'src', 'images', 'logo.png')).resize({ width: 320, withoutEnlargement: true }), logoOut, (p) =>
    p.webp({ quality: 88 }),
  );
}

await mkdir(DATA, { recursive: true });
await writeFile(path.join(DATA, 'images.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const contentEntries = Object.values(manifest.content);
const low = contentEntries.filter((e) => e.printQuality === 'low');
const reduced = contentEntries.filter((e) => e.printQuality === 'reduced');

console.log(`Derivados generados: ${written} · reutilizados: ${skipped}`);
console.log(`Peso de lo generado en esta corrida: ${(bytesOut / 1024 / 1024).toFixed(1)} MB`);
console.log(`Manifiesto → src/data/images.json`);
console.log(`\nCalidad para impresión A5 a 300 dpi:`);
console.log(`  página completa: ${contentEntries.length - low.length - reduced.length}`);
console.log(`  media caja:      ${reduced.length}`);
console.log(`  reducida:        ${low.length}  →  ${low.map((e) => e.key).join(', ')}`);
