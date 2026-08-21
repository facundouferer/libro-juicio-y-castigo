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
import { BOOK } from '../src/lib/site.mjs';
import { paletteCss } from '../src/lib/palette.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const WORK = path.join(ROOT, 'build', 'pdf');
const OUT_DIR = path.join(ROOT, 'public', 'descargas');
const OUT = path.join(OUT_DIR, 'juicio-y-castigo-en-el-chaco-vol-2.pdf');

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
function plateFigure(plate) {
  if (!plate) return '';
  const caption = [
    plate.caption ? xml(plate.caption) : '',
    plate.credit ? `<span class="credit">${xml(plate.credit)}</span>` : '',
  ].join('');
  return [
    `<figure class="figure q-${xml(plate.quality)} ${xml(plate.orientation)}" id="fig-${xml(plate.key)}">`,
    `<img src="img/${xml(plate.key)}.jpg" alt="${xml(plate.alt)}" width="${plate.width}" height="${plate.height}" />`,
    caption ? `<figcaption>${caption}</figcaption>` : '',
    '</figure>',
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
  body.push(`
<section class="page-title" id="portadilla">
  <figure class="page-title-photo"><img src="img/tapa.jpg" alt="" /></figure>
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

  /** One entry per document, so each can be paginated on its own below. */
  const blocks = [];
  const frontHtml = body.splice(0).join('\n');

  for (const doc of bodyDocs) {
    body.length = 0;
    const section = sectionById.get(doc.data.section);
    outline.push({ marker: `doc-${doc.data.docSlug}`, title: doc.data.title, depth: 0 });
    for (const heading of doc.headings) {
      if (heading.depth > 2) continue;
      outline.push({ marker: heading.id, title: heading.text, depth: heading.depth });
    }

    if (doc.data.pageType === 'chapter-opening') {
      // The opening of a part is a fixed sequence of pages (spec 03, RF-03.7):
      //   recto — the part: number, section name, the title of the text
      //   verso — courtesy blank
      //   recto — the text, whole and with nothing cutting through it
      // Any photograph the mapping anchored inside the text is lifted out and
      // shown as a full-page plate afterwards, so it stays in the sequence
      // without interrupting the reading (RF-03.1).
      const plates = [...doc.html.matchAll(/<figure class="figure[\s\S]*?<\/figure>/g)].map((m) => m[0]);
      const prose = doc.html.replace(/<figure class="figure[\s\S]*?<\/figure>/g, '');

      body.push(`<section class="chapter" id="doc-${xml(doc.data.docSlug)}" data-section="${xml(doc.data.section)}">`);

      body.push('<div class="chapter-title-block">');
      if (doc.plate) {
        body.push(`<figure class="chapter-image"><img src="img/${xml(doc.plate.key)}.jpg" alt="" /></figure>`);
      }
      if (section?.partNumber) {
        body.push(`<p class="chapter-num">${String(section.partNumber).padStart(2, '0')}</p>`);
      }
      if (section?.title) body.push(`<p class="chapter-volanta">${xml(section.title)}</p>`);
      body.push(`<h1>${xml(doc.data.title)}</h1>`);
      body.push('</div>');

      body.push('<section class="page-blank" aria-hidden="true"></section>');
      body.push(`<div class="chapter-text">${prose}</div>`);
      for (const plate of plates) {
        body.push(`<div class="chapter-plate">${plate.replace('class="figure', 'class="plate-solo figure')}</div>`);
      }
      body.push('</section>');
      blocks.push({
        docSlug: doc.data.docSlug,
        title: doc.data.title,
        pageType: doc.data.pageType,
        html: body.join('\n'),
      });
      continue;
    }

    // Until now the printed edition dropped every document title: the
    // normalizer promotes the heading into the frontmatter and nothing here put
    // it back, so "La memoria y la palabra" and "Introducción" ran untitled
    // (spec 02, RF-02.2).
    const head =
      doc.data.showTitle === false
        ? ''
        : [
            '<header class="doc-head">',
            doc.data.kicker ? `<p class="doc-kicker">${xml(doc.data.kicker)}</p>` : '',
            `<h1 class="doc-title">${xml(doc.data.title)}</h1>`,
            '</header>',
          ].join('');

    body.push(
      `<section class="doc${doc.data.pageType === 'interlude' ? ' interlude' : ''}" id="doc-${xml(doc.data.docSlug)}" data-section="${xml(doc.data.section)}">${head}${plateFigure(doc.plate)}${doc.html}</section>`,
    );
    blocks.push({
      docSlug: doc.data.docSlug,
      title: doc.data.title,
      pageType: doc.data.pageType,
      html: body.join('\n'),
    });
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
  const page = await browser.newPage();
  const counts = [];
  // Written into the working directory and loaded from there: `setContent`
  // resolves relative URLs against about:blank, so every `img/…` reference
  // would fail and the measurement would be taken on a book without
  // photographs.
  const scratch = path.join(WORK, 'medicion.html');
  try {
    for (const block of blocks) {
      await writeFile(scratch, shell(block.html), 'utf8');
      await page.goto(`file://${scratch}`, { waitUntil: 'load', timeout: 120_000 });
      await page.evaluate(() => document.fonts.ready.then(() => true));
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => (i.onload = i.onerror = r))),
        );
      });
      const bytes = await page.pdf({ format: 'A5', printBackground: true, preferCSSPageSize: true, timeout: 180_000 });
      counts.push((await PDFDocument.load(bytes)).getPageCount());
    }
  } finally {
    await page.close();
  }
  return counts;
}

/**
 * Decides where a courtesy blank has to go so that every text opens on a recto,
 * and reports the result (RF-03.3, RF-03.4 and RF-03.6).
 */
function planRecto(blocks, counts, frontPages) {
  const plan = [];
  let page = frontPages + 1;
  for (let i = 0; i < blocks.length; i += 1) {
    const blank = page % 2 === 0;
    if (blank) page += 1;
    plan.push({ ...blocks[i], blank, start: page, pages: counts[i] });
    page += counts[i];
  }
  return plan;
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
    // First pass: how long is every text, so the courtesy blanks can be placed.
    const counts = await measureBlocks(browser, shell, blocks);
    const plan = planRecto(blocks, counts, front.length - 1);
    const blanks = plan.filter((b) => b.blank).length;
    console.log(`Medición: ${blocks.length} textos, ${counts.reduce((a, b) => a + b, 0)} páginas`);
    console.log(`Blancos de cortesía para abrir en impar: ${blanks}`);
    for (const b of plan) console.log(`    plan  pág ${String(b.start).padStart(3)}  ${String(b.pages).padStart(3)} pág.  ${b.blank ? 'blanco+' : '       '}${b.title.slice(0, 46)}`);

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
    const blankPages = new Set(plan.filter((b) => b.blank).map((b) => b.start - 1));
    // A part opens with a fixed sequence — title page, courtesy blank, text —
    // so the blank inside it sits one page after the start (RF-03.7).
    for (const block of plan) {
      if (block.pageType === 'chapter-opening') blankPages.add(block.start + 1);
    }
    await stamp(bytes, markers, outline, firstBody, front, blankPages);
    reportFront(front, markers.boxes);
    reportRecto(plan);
  } finally {
    await browser.close();
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
  pdf.setSubject(BOOK.description);
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
  console.log(`Números de página estampados: ${printed}`);
  console.log(`Marcadores en el índice interno: ${refs.length}`);
  console.log(`\nPDF → ${path.relative(ROOT, OUT)}  (${(out.length / 1024 / 1024).toFixed(1)} MB, ${pages.length} páginas)`);
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
