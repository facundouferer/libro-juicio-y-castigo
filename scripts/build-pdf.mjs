/**
 * Builds the A5 PDF.
 *
 * Three stages:
 *   1. Assemble a single print-oriented HTML document from the same markdown
 *      the site renders, with the same image anchoring.
 *   2. Paginate it with the system Chrome. Chrome's own layout engine handles
 *      A5, widows, orphans and break-inside far better than a polyfill, and it
 *      is already installed — nothing is downloaded for this.
 *   3. Stamp page numbers and build the PDF outline with pdf-lib. Chrome's
 *      footer templates cannot skip the cover, and they cannot be told which
 *      pages are content pages; doing it afterwards can.
 *
 * The PDF is committed to public/descargas/ and served as a static file, so
 * nothing is generated when a reader presses Descargar.
 */

import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts, rgb, PDFName, PDFNumber, PDFString, PDFArray, PDFDict } from 'pdf-lib';
import { renderBook, xml } from './lib/render-book.mjs';
import { SECTIONS } from './manifest.mjs';
import { containerFor } from '../src/lib/image-format.mjs';
import { BOOK } from '../src/lib/site.mjs';
import { paletteCss } from '../src/lib/palette.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const WORK = path.join(ROOT, 'build', 'pdf');
const OUT_DIR = path.join(ROOT, 'public', 'descargas');
const OUT = path.join(OUT_DIR, 'juicio-y-castigo-en-el-chaco-vol-2.pdf');

/** Which edition of the book this is (specs-v12, spec 09, RF-09.3). */
const VERSION = JSON.parse(
  await readFile(path.join(ROOT, 'package.json'), 'utf8'),
).version.replace(/\.0$/, '');

/** Fewest lines of text a page may carry (specs-v12, spec 05, RF-05.4). */
const MIN_LINES = 5;

/** A5 in PDF points (72 per inch): 148 × 210 mm. */
const PAGE_W = (148 / 25.4) * 72;
const PAGE_H = (210 / 25.4) * 72;

const fontFace = (family, weight, style, file) => `
@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: ${weight};
  src: url('file://${path.join(ROOT, file)}') format('woff2');
  font-display: block;
}`;

/**
 * The figure for a document-wide photograph. Openings, interludes and documents
 * with no headings carry one; the anchoring plugin never emits it because it is
 * bound to the document, not to a heading (spec 04, RF-04.6).
 */
function plateFigure(plate, container) {
  if (!plate) return '';
  const caption = [
    plate.caption ? xml(plate.caption) : '',
    plate.credit ? `<span class="credit">${xml(plate.credit)}</span>` : '',
  ].join('');
  const box = container ?? containerFor(plate.key, plate, { caption: plate.caption });
  return [
    `<figure class="figure q-${xml(plate.quality)} ${xml(plate.orientation)} ${xml(box)}" id="fig-${xml(plate.key)}">`,
    `<img src="img/${xml(plate.key)}.jpg" alt="${xml(plate.alt)}" width="${plate.width}" height="${plate.height}" />`,
    caption ? `<figcaption>${caption}</figcaption>` : '',
    '</figure>',
  ].join('');
}

/** A document's own photograph, at the foot of its text (spec 06, RF-06.3). */
function tailPlate(plate) {
  const figure = plateFigure(plate);
  return figure ? `<div class="tail-figures">${figure}</div>` : '';
}

/** Title, byline and — for the few that still carry one — overline. */
function docHead(doc) {
  if (doc.data.showTitle === false && !doc.data.byline) return '';
  return [
    '<header class="doc-head">',
    doc.data.kicker ? `<p class="doc-kicker">${xml(doc.data.kicker)}</p>` : '',
    doc.data.showTitle === false ? '' : `<h1 class="doc-title">${xml(doc.data.title)}</h1>`,
    // Below the title and before the first paragraph, so the voice is
    // identified from the start (specs-v12, spec 02, RF-02.1).
    doc.data.byline ? `<p class="doc-byline">${xml(doc.data.byline)}</p>` : '',
    '</header>',
  ].join('');
}

async function buildHtml() {
  const documents = await renderBook('print');
  const css = await readFile(path.join(ROOT, 'src', 'styles', 'print.css'), 'utf8');
  const sectionById = new Map(SECTIONS.map((s) => [s.id, s]));

  const fonts = [
    fontFace('Oswald', 500, 'normal', 'node_modules/@fontsource/oswald/files/oswald-latin-500-normal.woff2'),
    fontFace('Oswald', 600, 'normal', 'node_modules/@fontsource/oswald/files/oswald-latin-600-normal.woff2'),
    fontFace('Oswald', 700, 'normal', 'node_modules/@fontsource/oswald/files/oswald-latin-700-normal.woff2'),
    fontFace(
      'Source Sans 3',
      '400 700',
      'normal',
      'node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2',
    ),
    fontFace(
      'Source Sans 3',
      '400 700',
      'italic',
      'node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-italic.woff2',
    ),
  ].join('\n');

  const body = [];
  /** Feeds the PDF outline in stage 3 and the printed contents page here. */
  const outline = [];

  const cover = documents.find((d) => d.data.pageType === 'landing');
  const citations = documents.find((d) => d.data.pageType === 'citations');
  const colophon = documents.find((d) => d.data.pageType === 'colophon');
  const FRONT = new Set(['landing', 'citations', 'colophon']);
  const bodyDocs = documents.filter((d) => !FRONT.has(d.data.pageType));

  // Order of precedence, as the editorial pass set it out (spec 01):
  //   portadilla · citas · créditos (reverso) · índice · primer texto
  // What used to open the book — "Sobre este libro" — is back-cover copy and
  // now closes it (RF-01.3).
  // No photograph inside: this is the half title, not the cover, and the
  // photograph took more than half the page from the type that has to carry it
  // (specs-v12, spec 01, RF-01.1). The cover art is untouched — it is still the
  // cover of the site and of the EPUB.
  body.push(`
<section class="page-title" id="portadilla">
  <div class="page-title-block">
    <h1>${xml(BOOK.title)}<br />${xml(BOOK.volume)}</h1>
    <p class="sub">${xml(BOOK.subtitle)}</p>
    <p class="kicker">${xml(BOOK.kicker)}</p>
  </div>
  <img class="page-title-logo" src="logo.webp" alt="${xml(BOOK.publisher)}" />
</section>`);

  // Courtesy blanks, written out rather than hoped for. Each front section is
  // exactly one page tall, so the sequence below is deterministic: portadilla 1,
  // blank 2, citas 3, créditos 4, índice 5, blank 6, first text 7 — every
  // opening on a recto (spec 01, CA-01.1 to CA-01.4).
  body.push('<section class="page-blank" aria-hidden="true"></section>');

  if (citations?.html) {
    body.push(`<section class="page-citations" id="doc-${xml(citations.data.docSlug)}">${citations.html}</section>`);
  }
  if (colophon?.html) {
    body.push(`<section class="page-colophon" id="doc-${xml(colophon.data.docSlug)}">${colophon.html}</section>`);
  }

  // The printed contents page lists parts and documents only; the full
  // 244-heading tree belongs in the PDF outline, not on paper. It has to fit on
  // one page (RF-01.5), so the front matter above it is not listed.
  const toc = ['<section class="page-toc" id="indice"><h2>Índice</h2><ul class="toc-list">'];
  let lastSection = null;
  for (const doc of bodyDocs) {
    if (doc.data.section !== lastSection) {
      const section = sectionById.get(doc.data.section);
      toc.push(
        `<li class="toc-part">${xml(section?.part ? `${section.part} — ${section.title}` : (section?.title ?? doc.data.section))}</li>`,
      );
      lastSection = doc.data.section;
    }
    toc.push(`<li class="toc-doc">${xml(doc.data.title)}</li>`);
  }
  toc.push('</ul></section>');
  body.push(toc.join('\n'));
  body.push('<section class="page-blank" aria-hidden="true"></section>');

  for (const doc of [citations, colophon].filter(Boolean)) {
    outline.push({ marker: `doc-${doc.data.docSlug}`, title: doc.data.title, depth: 0 });
  }

  /**
   * One entry per block, so each can be paginated on its own below.
   *
   * A block used to be a document. That was the wrong unit: three of the 24
   * documents hold between four and thirteen chronicles each, and inside a
   * document nothing controlled where a chronicle fell — which is why the
   * editorial pass found chronicles starting at the foot of a verso on pages
   * 47, 49, 79, 89 and 94. The block is now the chronicle (specs-v12, spec 05,
   * RF-05.1), and every one of them opens on a recto.
   */
  const blocks = [];
  const frontHtml = body.splice(0).join('\n');

  /** The section cover: a recto that carries the part, and its photograph overleaf. */
  function partBlock(section, plate) {
    const cover = [
      `<section class="page-part" id="parte-${xml(section.id)}" data-section="${xml(section.id)}">`,
      section.partNumber ? `<p class="part-num">${String(section.partNumber).padStart(2, '0')}</p>` : '',
      `<p class="part-label">${xml(section.part)}</p>`,
      `<h1 class="part-title">${xml(section.title)}</h1>`,
      section.blurb ? `<p class="part-blurb">${xml(section.blurb)}</p>` : '',
      '</section>',
    ].join('');

    // The verso is the section's photograph, full page. It used to sit squashed
    // above the title on the same page, where it competed with it; and the
    // verso it now occupies used to be a courtesy blank (spec 03, RF-03.2).
    const verso = plate
      ? `<section class="page-plate" data-section="${xml(section.id)}">${plateFigure(plate, 'box-page')}</section>`
      : '<section class="page-blank" aria-hidden="true"></section>';

    return {
      docSlug: `parte-${section.id}`,
      title: `${section.part} — ${section.title}`,
      pageType: 'part',
      kind: 'part',
      html: `${cover}\n${verso}`,
    };
  }

  let lastPart = null;

  for (const doc of bodyDocs) {
    body.length = 0;
    const section = sectionById.get(doc.data.section);

    // Each part opens with a cover of its own, so the section stops being an
    // overline on top of the title of its first text (spec 03, RF-03.1).
    if (section?.part && doc.data.section !== lastPart) {
      const opening = bodyDocs.find(
        (d) => d.data.section === section.id && d.data.pageType === 'chapter-opening',
      );
      outline.push({ marker: `parte-${section.id}`, title: `${section.part} — ${section.title}`, depth: 0 });
      blocks.push(partBlock(section, opening?.plate ?? null));
      lastPart = doc.data.section;
    }

    outline.push({ marker: `doc-${doc.data.docSlug}`, title: doc.data.title, depth: 0 });
    for (const heading of doc.headings) {
      if (heading.depth > 2) continue;
      outline.push({ marker: heading.id, title: heading.text, depth: heading.depth });
    }

    const head = docHead(doc);

    if (doc.data.pageType === 'chapter-opening') {
      // The photograph moved to the section cover overleaf, so the opening text
      // is now simply a text: its own page, its own title, nothing above it.
      blocks.push({
        docSlug: doc.data.docSlug,
        title: doc.data.title,
        pageType: doc.data.pageType,
        kind: 'doc',
        html:
          `<section class="doc opening" id="doc-${xml(doc.data.docSlug)}" data-section="${xml(doc.data.section)}">` +
          `${head}${doc.html}</section>`,
      });
      continue;
    }

    const klass = `doc${doc.data.pageType === 'interlude' ? ' interlude' : ''}`;
    const open = `<section class="${klass}" id="doc-${xml(doc.data.docSlug)}" data-section="${xml(doc.data.section)}">`;

    // A document splits at its chronicles. `parts[0]` is whatever comes before
    // the first one — a preamble, or nothing at all.
    const parts = doc.html.split(/(?=<header class="cronica-head">)/);
    const preamble = parts[0]?.trim() ?? '';
    const cronicas = parts.slice(1);

    if (!cronicas.length) {
      blocks.push({
        docSlug: doc.data.docSlug,
        title: doc.data.title,
        pageType: doc.data.pageType,
        kind: 'doc',
        // The document's photograph goes after its text, never between the
        // title and the first paragraph (specs-v12, spec 06, RF-06.3).
        html: `${open}${head}${doc.html}${tailPlate(doc.plate)}</section>`,
      });
      continue;
    }

    if (head || preamble || doc.plate) {
      blocks.push({
        docSlug: doc.data.docSlug,
        title: doc.data.title,
        pageType: doc.data.pageType,
        kind: 'doc',
        html: `${open}${head}${preamble}${tailPlate(doc.plate)}</section>`,
      });
    }

    for (const [i, cronica] of cronicas.entries()) {
      const id = /<p class="cronica-volanta" id="([^"]+)"/.exec(cronica)?.[1] ?? '';
      const titular = /<h2[^>]*class="cronica-title"[^>]*>([\s\S]*?)<\/h2>/.exec(cronica)?.[1];
      const volanta = /<p class="cronica-volanta"[^>]*>([\s\S]*?)<\/p>/.exec(cronica)?.[1] ?? '';
      const label = (titular ?? volanta).replace(/<[^>]+>/g, '').trim();
      blocks.push({
        docSlug: id || `${doc.data.docSlug}-${i}`,
        title: label || doc.data.title,
        pageType: doc.data.pageType,
        kind: 'cronica',
        html: `${open.replace('class="', 'class="cronica ')}${cronica}</section>`,
      });
    }
  }

  body.length = 0;

  const backHtml = cover?.html
    ? `<section class="page-blurb" id="contratapa"><h2>Sobre este libro</h2>${cover.html}</section>`
    : '';

  const html = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8" />
<title>${xml(`${BOOK.title} (${BOOK.volume})`)}</title>
<style>${fonts}</style>
<style>${paletteCss()}</style>
<style>${css}</style>
</head>
<body>
${frontHtml}
${blocks.map((b) => b.html).join('\n')}
${backHtml}
</body>
</html>`;

  /**
   * Wraps arbitrary section markup in the same document shell, for measuring.
   *
   * The breaks at both ends are neutralised. In the assembled book they only
   * decide where a block starts and stops; measured on its own, a leading
   * `break-before: page` pushes the content onto a second page and a trailing
   * `break-after: page` — which every interlude carries — leaves an empty one
   * behind. Either would make the count one too long, and the error accumulates
   * down the book until texts start landing on versos again.
   */
  const shell = (inner) => `<!doctype html>
<html lang="es-AR"><head><meta charset="utf-8" />
<style>${fonts}</style><style>${paletteCss()}</style><style>${css}</style>
<style>
  body > :first-child, body > :first-child > :first-child {
    break-before: auto !important;
    page-break-before: auto !important;
  }
  body > :last-child, body > :last-child > :last-child {
    break-after: auto !important;
    page-break-after: auto !important;
  }
</style>
</head><body>${inner}</body></html>`;

  return {
    html,
    shell,
    frontHtml,
    blocks,
    backHtml,
    documents,
    outline,
    firstBody: bodyDocs[0]?.data.docSlug ?? null,
    front: [
      { id: 'portadilla', label: 'Portadilla', page: 1 },
      { id: null, label: 'Blanco de cortesía', page: 2 },
      citations && { id: `doc-${citations.data.docSlug}`, label: 'Citas', page: 3 },
      colophon && { id: `doc-${colophon.data.docSlug}`, label: 'Créditos', page: 4 },
      { id: 'indice', label: 'Índice', page: 5 },
      { id: null, label: 'Blanco de cortesía', page: 6 },
      bodyDocs[0] && { id: `doc-${bodyDocs[0].data.docSlug}`, label: bodyDocs[0].data.title, page: 7 },
    ].filter(Boolean),
  };
}

/**
 * How many A5 pages each block takes, measured by paginating it on its own.
 *
 * Chrome does not implement `break-before: recto`, so the only way to start
 * every text on an odd page is to know where each one lands and insert the
 * courtesy blanks by hand (spec 03, RF-03.3). Measuring block by block is exact
 * because every block already begins on a fresh page: what precedes it cannot
 * change its length, only its offset.
 */
async function measureBlocks(browser, shell, blocks) {
  // A5 content box at 96 CSS px per inch, under print media. `page.pdf()` would
  // paginate correctly whatever the viewport, but the DOM measurement below
  // would not: at the default 1280 px the same text takes a third of the lines,
  // and every leftover it reported was meaningless.
  const page = await browser.newPage({ viewport: { width: 450, height: 680 } });
  await page.emulateMedia({ media: 'print' });
  const counts = [];
  /** How many lines of text the block's last page carries. See below. */
  const tails = [];
  // Written into the working directory and loaded from there: `setContent`
  // resolves relative URLs against about:blank, so every `img/…` reference
  // would fail and the measurement would be taken on a book without
  // photographs.
  const scratch = path.join(WORK, 'medicion.html');
  try {
    for (const block of blocks) {
      await writeFile(scratch, shell(typeof block === 'string' ? block : block.html), 'utf8');
      await page.goto(`file://${scratch}`, { waitUntil: 'load', timeout: 120_000 });
      await page.evaluate(() => document.fonts.ready.then(() => true));
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => (i.onload = i.onerror = r))),
        );
      });
      const bytes = await page.pdf({ format: 'A5', printBackground: true, preferCSSPageSize: true, timeout: 180_000 });
      const pages = (await PDFDocument.load(bytes)).getPageCount();
      counts.push(pages);

      /**
       * How full the block's last page is.
       *
       * Measured here rather than on the assembled book because here it is
       * exact: the block starts at the top of a page and flows continuously, so
       * the leftover of its scroll height over whole pages is what lands on the
       * last one. On the assembled document the same arithmetic is only
       * proportional, and it reported pages as one-line that in fact carried
       * twenty-nine.
       *
       * A block that forces a page break inside it — a photograph that takes a
       * page of its own — breaks that assumption, and is not measured.
       */
      const html = typeof block === 'string' ? block : block.html;
      tails.push(
        /\bbox-page\b/.test(html)
          ? null
          : await page.evaluate(
              (contentPx) => {
                const height = document.documentElement.scrollHeight;
                const line = parseFloat(getComputedStyle(document.body).lineHeight) || 14;
                const whole = Math.max(0, Math.ceil(height / contentPx) - 1);
                return Math.round(((height - whole * contentPx) / line) * 10) / 10;
              },
              (180 / 25.4) * 96,
            ),
      );
    }
  } finally {
    await page.close();
  }
  counts.tails = tails;
  return counts;
}

/**
 * The last photograph a block carries, promoted to a page of its own.
 *
 * Returns null when the block has no tail figures to promote — a text that
 * carries no photograph, or one whose last figure already takes a full page.
 */
function promoteLastFigure(html) {
  const figures = [...html.matchAll(/<figure class="figure ([^"]*)"/g)];
  const last = figures.at(-1);
  if (!last || /\bbox-page\b/.test(last[1])) return null;
  const at = last.index;
  return html.slice(0, at) + html.slice(at).replace(/\bbox-(full|two-thirds)\b/, 'box-page');
}

/**
 * Where every block starts, so that every one of them opens on a recto.
 *
 * Chrome does not implement `break-before: recto`, so the parity has to be
 * arranged by hand. A block that runs an odd number of pages leaves the next
 * one on a verso, and something has to take up the slack.
 *
 * What takes it up is a photograph, not a blank (specs-v12, spec 05, RF-05.3):
 * the block is measured again with its last figure promoted to a page of its
 * own, which is where the image wanted to go anyway — after the last paragraph
 * of the chronicle and before the next one begins (spec 06, RF-06.4). Only when
 * there is no figure to promote, or promoting it does not fix the parity, does
 * the block get a courtesy blank behind it.
 */
async function planRecto(browser, shell, blocks, counts, frontPages) {
  const plan = blocks.map((block, i) => ({
    ...block,
    pages: counts[i],
    tail: counts.tails?.[i] ?? null,
    blank: false,
    plated: false,
  }));

  // Candidates: an odd block, with a figure that could take the page instead.
  const candidates = [];
  for (const [i, block] of plan.entries()) {
    if (block.pages % 2 === 0) continue;
    const promoted = promoteLastFigure(block.html);
    if (promoted) candidates.push({ i, promoted });
  }

  if (candidates.length) {
    const recount = await measureBlocks(browser, shell, candidates.map((c) => c.promoted));
    for (const [n, candidate] of candidates.entries()) {
      if (recount[n] % 2 !== 0) continue;
      plan[candidate.i].html = candidate.promoted;
      plan[candidate.i].pages = recount[n];
      plan[candidate.i].tail = recount.tails?.[n] ?? null;
      plan[candidate.i].plated = true;
    }
  }

  await tightenShortTails(browser, shell, plan);

  let page = frontPages + 1;
  for (const block of plan) {
    block.blank = page % 2 === 0;
    if (block.blank) page += 1;
    block.start = page;
    page += block.pages;
  }
  return plan;
}

/**
 * Pulls a stranded tail back onto the page before it.
 *
 * A text that runs two lines over leaves a page with two lines on it — the
 * defect the editorial pass reported on page 36. The fix is the one a designer
 * would make by hand: set that text a hair tighter until its last lines come
 * back. Three steps, the largest of them 4 % off the book's leading, and the
 * first that works is kept. A text that none of them rescues is reported and
 * left alone rather than squeezed out of shape (specs-v12, spec 05, RF-05.4).
 */
async function tightenShortTails(browser, shell, plan) {
  const steps = ['is-tight-1', 'is-tight-2', 'is-tight-3', 'is-tight-4', 'is-loose-1', 'is-loose-2'];

  for (let step = 0; step < steps.length; step += 1) {
    const short = plan.filter(
      (b) =>
        b.kind !== 'part' &&
        b.pages > 1 &&
        b.tail !== null &&
        b.tail > 0.2 &&
        b.tail < MIN_LINES,
    );
    if (!short.length) return;

    // The class goes on the block's own section, whatever else it carries —
    // `doc`, `doc opening`, `cronica doc`, `doc interlude`.
    const variants = short.map((b) =>
      b.html.replace('<section class="', `<section class="${steps[step]} `),
    );
    const measured = await measureBlocks(browser, shell, variants);

    for (const [n, block] of short.entries()) {
      const tail = measured.tails?.[n] ?? null;
      if (process.env.PDF_DEBUG) {
        console.log(`      ${steps[step]}  ${block.title.slice(0, 34).padEnd(34)} ${block.pages}p/${block.tail} → ${measured[n]}p/${tail}`);
      }
      // Worth keeping only when the tail is gone or genuinely fuller.
      // Accept only a real improvement: the tail absorbed into the page before,
      // or a last page that now carries a proper amount of reading. Never a
      // variant that costs a page without fixing anything.
      if (
        (measured[n] < block.pages && (tail === null || tail >= MIN_LINES || tail < 0.2)) ||
        (measured[n] === block.pages && tail !== null && tail >= MIN_LINES)
      ) {
        block.html = variants[n];
        block.pages = measured[n];
        block.tail = tail;
        block.tightened = steps[step];
      }
    }
  }
}

async function main() {
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const printImages = path.join(ROOT, 'build', 'print');
  if (!existsSync(printImages)) {
    throw new Error('Faltan los derivados de impresión. Corré primero: npm run images');
  }
  await cp(printImages, path.join(WORK, 'img'), { recursive: true });
  await cp(path.join(ROOT, 'public', 'img', 'logo.webp'), path.join(WORK, 'logo.webp'));

  const built = await buildHtml();
  const { outline, firstBody, front, shell, frontHtml, blocks, backHtml } = built;

  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    // First pass: how long is every block, so the parity can be arranged.
    const counts = await measureBlocks(browser, shell, blocks);
    const plan = await planRecto(browser, shell, blocks, counts, front.length - 1);
    const blanks = plan.filter((b) => b.blank).length;
    const plated = plan.filter((b) => b.plated).length;
    const cronicas = plan.filter((b) => b.kind === 'cronica').length;
    console.log(`Medición: ${blocks.length} bloques (${cronicas} crónicas), ${counts.reduce((a, b) => a + b, 0)} páginas`);
    const tightened = plan.filter((b) => b.tightened).length;
    console.log(`Páginas ganadas por una imagen a página completa: ${plated}`);
    if (tightened) {
      console.log(`Textos ajustados de interlineado para no dejar una cola suelta: ${tightened}`);
      for (const b of plan.filter((x) => x.tightened)) {
        console.log(`    ${b.tightened.padEnd(12)} ${b.title.slice(0, 46)}`);
      }
    }
    console.log(`Blancos de cortesía que quedaron: ${blanks}`);
    for (const b of plan) {
      const mark = b.blank ? 'blanco+' : b.plated ? 'imagen+' : '       ';
      console.log(`    plan  pág ${String(b.start).padStart(3)}  ${String(b.pages).padStart(3)} pág.  ${mark}${b.title.slice(0, 46)}`);
    }

    const html = [
      built.html.slice(0, built.html.indexOf('<body>') + 6),
      frontHtml,
      ...plan.map((b) => `${b.blank ? '<section class="page-blank" aria-hidden="true"></section>\n' : ''}${b.html}`),
      backHtml,
      '</body>\n</html>',
    ].join('\n');

    const htmlPath = path.join(WORK, 'libro.html');
    await writeFile(htmlPath, html, 'utf8');
    console.log(`HTML de impresión → ${path.relative(ROOT, htmlPath)} (${(Buffer.byteLength(html) / 1024).toFixed(0)} kB)`);

    // A5 content box: 119 × 180 mm at 96 CSS px per inch. Measuring the flow at
    // the size it will actually be printed at — and under print media, so the
    // paged-media rules apply — is what makes the heights below meaningful.
    const page = await browser.newPage({ viewport: { width: 450, height: 680 } });
    await page.emulateMedia({ media: 'print' });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load', timeout: 180_000 });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    // Chrome resolves lazily-decoded images after load; the pagination has to
    // see their real dimensions or every figure claims the wrong height.
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => (i.onload = i.onerror = r))),
      );
    });

    // Anchor positions, read before the PDF exists, so page numbers can be
    // resolved from the y offset of each marker once the page count is known.
    const markers = await page.evaluate(() => {
      const out = {};
      for (const el of document.querySelectorAll('[id]')) {
        out[el.id] = el.getBoundingClientRect().top + window.scrollY;
      }
      // Front sections must each hold on a single page; the index especially,
      // which the editorial pass found broken over two (spec 01, RF-01.5).
      const boxes = {};
      for (const selector of ['#indice', '.page-citations', '.page-colophon', '.page-title']) {
        const el = document.querySelector(selector);
        if (el) boxes[selector] = el.getBoundingClientRect().height;
      }
      // Every front block is full-page and breaks after itself, so the flow
      // height up to the first text is exactly the front matter's page count.
      for (const el of document.querySelectorAll('.page-blank, .page-title, .page-citations, .page-colophon, .page-toc')) {
        boxes[`each:${el.className}`] = el.getBoundingClientRect().height;
      }
      return { markers: out, height: document.documentElement.scrollHeight, boxes };
    });

    const bytes = await page.pdf({
      format: 'A5',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      timeout: 300_000,
    });
    await writeFile(path.join(WORK, 'raw.pdf'), bytes);
    console.log(`Paginado por Chrome: ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);

    // A courtesy blank is blank: no folio, no ornament (spec 03, RF-03.4).
    const unnumbered = new Set(plan.filter((b) => b.blank).map((b) => b.start - 1));
    // Nor does a section cover or the photograph on its reverse: a carátula is
    // read as a threshold, and a folio on it reads as a page of text.
    for (const block of plan) {
      if (block.kind !== 'part') continue;
      unnumbered.add(block.start);
      unnumbered.add(block.start + 1);
    }
    await stamp(bytes, markers, outline, firstBody, front, unnumbered);
    reportFront(front, markers.boxes);
    reportRecto(plan);
    reportShortPages(plan);
  } finally {
    await browser.close();
  }
}

/**
 * Texts whose last page carries almost no text — the «página 36 con una sola
 * línea» the editorial pass reported (specs-v12, spec 05, RF-05.4).
 *
 * A block of a single page is not a defect: the interludes are one page long by
 * design. Nor is a block whose last page is a photograph. What is reported is a
 * text that runs over and leaves a line or two stranded behind it.
 */
function reportShortPages(plan) {
  const short = plan.filter(
    (block) => block.pages > 1 && block.tail !== null && block.tail > 0.2 && block.tail < MIN_LINES,
  );

  if (!short.length) {
    console.log(`\nNingún texto deja menos de ${MIN_LINES} líneas en su última página (RF-05.4).`);
    return;
  }
  console.error(`\nTextos que dejan menos de ${MIN_LINES} líneas en su última página (RF-05.4): ${short.length}`);
  for (const block of short) {
    console.error(`  pág. ${block.start + block.pages - 1}  ${block.tail} líneas  ${block.title.slice(0, 46)}`);
  }
}

/** Every text and where it opens, with the parity the editorial pass asked for. */
function reportRecto(plan) {
  const even = plan.filter((b) => b.start % 2 === 0);
  console.log(`\nAperturas en impar: ${plan.length - even.length} de ${plan.length}`);
  if (even.length) {
    console.error('\nTextos que abren en página par (spec 03, RF-03.3):');
    for (const block of even) console.error(`  pág. ${block.start}  ${block.title}`);
    process.exitCode = 1;
  }
}

/** A5 content box height in CSS pixels — 180 mm at 96 px per inch. */
const CONTENT_PX = (180 / 25.4) * 96;

/**
 * The order of precedence, and whether each front page actually holds on the
 * page it is supposed to. The page numbers are structural: every front section
 * is a full-height block that breaks after itself, so the sequence follows from
 * the markup rather than from measuring a flowed document.
 */
function reportFront(front, boxes) {
  console.log('\nOrden de prelación:');
  for (const item of front) {
    const side = item.page % 2 === 1 ? 'impar' : 'par';
    console.log(`  pág. ${String(item.page).padStart(2)}  ${side.padEnd(5)}  ${item.label}`);
  }

  const limits = {
    '.page-title': 'Portadilla',
    '.page-citations': 'Citas',
    '.page-colophon': 'Créditos',
    '#indice': 'Índice',
  };
  const over = Object.entries(limits)
    .filter(([selector]) => boxes[selector] > CONTENT_PX + 1)
    .map(([selector, label]) => `${label} ocupa ${(boxes[selector] / CONTENT_PX).toFixed(2)} páginas`);

  if (over.length) {
    console.error(`\nNo entran en una página (spec 01, RF-01.5):`);
    for (const line of over) console.error(`  ${line}`);
    process.exitCode = 1;
  } else {
    console.log('  Todas las piezas del frente entran en su página.');
  }
}

/** Adds page numbers, the outline and the document metadata. */
async function stamp(bytes, { markers, height }, outline, firstBody, front, blankPages = new Set()) {
  const pdf = await PDFDocument.load(bytes);
  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  pdf.setTitle(`${BOOK.title} (${BOOK.volume}) — ${BOOK.subtitle}`);
  pdf.setSubject(`${BOOK.description} Edición ${VERSION}.`);
  pdf.setProducer(BOOK.publisher);
  pdf.setCreator(BOOK.publisher);
  pdf.setLanguage('es-AR');
  pdf.setKeywords([
    'lesa humanidad',
    'Brigada de Investigaciones',
    'Chaco',
    'terrorismo de Estado',
    'juicio y castigo',
    'memoria',
    `versión ${VERSION}`,
  ]);

  // Front matter carries no folio. Rather than hard-coding how many pages it
  // takes — which changed with the new order of precedence — the first numbered
  // page is derived from where the first text of the book actually landed.
  const pageAt = (offset) =>
    Math.min(pages.length - 1, Math.max(0, Math.floor((offset / height) * pages.length)));
  // Front matter carries no folio and is exactly `front.length` pages long.
  const FIRST_NUMBERED = front.at(-1)?.page ? front.at(-1).page - 1 : 6;
  let printed = 0;

  for (let i = FIRST_NUMBERED; i < pages.length; i += 1) {
    // `i` is a zero-based index; the plan counts pages from one.
    if (blankPages.has(i + 1)) continue;
    const page = pages[i];
    const label = String(i - FIRST_NUMBERED + 1);
    const size = 8;
    const width = font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: (PAGE_W - width) / 2,
      y: 22,
      size,
      font,
      color: rgb(0.34, 0.36, 0.39),
    });
    printed += 1;
  }

  // Map each anchor's y offset in the flowed document onto a page index. The
  // mapping is proportional, which is exact enough for an outline: Chrome laid
  // the same content out at the same scale.
  const pageOf = pageAt;

  const refs = [];
  for (const item of outline) {
    const offset = markers[item.marker];
    if (offset === undefined) continue;
    refs.push({ ...item, page: pageOf(offset) });
  }

  if (refs.length) buildOutline(pdf, refs, pages);

  const out = await pdf.save({ useObjectStreams: true });
  await writeFile(OUT, out);
  const pageCount = pages.length;
  console.log(`Números de página estampados: ${printed}`);
  console.log(`Marcadores en el índice interno: ${refs.length}`);
  console.log(`\nPDF → ${path.relative(ROOT, OUT)}  (${(out.length / 1024 / 1024).toFixed(1)} MB, ${pageCount} páginas)`);
  return pageCount;
}

/**
 * Writes a two-level PDF outline — one entry per document with its h1/h2
 * nested underneath — so a reader can navigate 300-odd pages from the sidebar.
 *
 * pdf-lib has no outline API, so the tree is assembled by hand against the
 * spec: every item needs Parent, and the siblings at each level need Prev/Next
 * plus First/Last on their parent, or viewers show an empty panel.
 */
function buildOutline(pdf, refs, pages) {
  const { context, catalog } = pdf;

  const rootRef = context.nextRef();
  const rootDict = PDFDict.withContext(context);

  const makeItem = (ref, parentRef) => {
    const itemRef = context.nextRef();
    const dict = PDFDict.withContext(context);
    dict.set(PDFName.of('Title'), PDFString.of(ref.title.replace(/\s+/g, ' ').slice(0, 180)));
    dict.set(PDFName.of('Parent'), parentRef);

    // An XYZ destination with nulls means "this page, keep the current zoom".
    const dest = PDFArray.withContext(context);
    dest.push(pages[ref.page].ref);
    dest.push(PDFName.of('XYZ'));
    dest.push(context.obj(null));
    dest.push(context.obj(null));
    dest.push(context.obj(null));
    dict.set(PDFName.of('Dest'), dest);

    context.assign(itemRef, dict);
    return { ref: itemRef, dict };
  };

  const tops = [];
  let current = null;

  for (const ref of refs) {
    if (ref.depth === 0) {
      current = { ...makeItem(ref, rootRef), children: [] };
      tops.push(current);
    } else if (current) {
      current.children.push(makeItem(ref, current.ref));
    }
  }

  const link = (nodes, parentDict) => {
    if (!nodes.length) return 0;
    let total = nodes.length;

    nodes.forEach((node, i) => {
      if (i > 0) node.dict.set(PDFName.of('Prev'), nodes[i - 1].ref);
      if (i < nodes.length - 1) node.dict.set(PDFName.of('Next'), nodes[i + 1].ref);

      if (node.children?.length) {
        const nested = link(node.children, node.dict);
        // Negative Count keeps a branch collapsed when the file opens.
        node.dict.set(PDFName.of('Count'), PDFNumber.of(-nested));
        total += nested;
      }
    });

    parentDict.set(PDFName.of('First'), nodes[0].ref);
    parentDict.set(PDFName.of('Last'), nodes.at(-1).ref);
    return total;
  };

  const total = link(tops, rootDict);
  rootDict.set(PDFName.of('Type'), PDFName.of('Outlines'));
  rootDict.set(PDFName.of('Count'), PDFNumber.of(total));
  context.assign(rootRef, rootDict);
  catalog.set(PDFName.of('Outlines'), rootRef);
}

await main();
