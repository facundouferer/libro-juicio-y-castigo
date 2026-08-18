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

  body.push(`
<section class="page-cover">
  <h1>${xml(BOOK.title)}<br />${xml(BOOK.volume)}</h1>
  <p class="sub">${xml(BOOK.subtitle)}</p>
  <p class="kicker">${xml(BOOK.kicker)}</p>
  <p class="publisher">${xml(BOOK.publisher)}</p>
</section>`);

  if (cover?.html) {
    body.push(`<section class="page-blurb"><h2>Sobre este libro</h2>${cover.html}</section>`);
  }

  // The printed contents page lists parts and documents only; the full
  // 244-heading tree belongs in the PDF outline, not on paper.
  const toc = ['<section class="page-toc"><h2>Índice</h2><ul class="toc-list">'];
  let lastSection = null;
  for (const doc of documents) {
    if (doc.data.pageType === 'landing') continue;
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

  for (const doc of documents) {
    if (doc.data.pageType === 'landing') continue;

    const section = sectionById.get(doc.data.section);
    outline.push({ marker: `doc-${doc.data.docSlug}`, title: doc.data.title, depth: 0 });
    for (const heading of doc.headings) {
      if (heading.depth > 2) continue;
      outline.push({ marker: heading.id, title: heading.text, depth: heading.depth });
    }

    if (doc.data.pageType === 'chapter-opening') {
      // The opening's own photograph takes the recto; the text follows overleaf.
      const image = /<figure class="figure[^"]*"[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>/.exec(doc.html);
      body.push(`<section class="chapter" id="doc-${xml(doc.data.docSlug)}">`);
      if (image) {
        body.push(`<figure class="chapter-image"><img src="${xml(image[1])}" alt="" /></figure>`);
      }
      body.push('<div class="chapter-title-block">');
      if (section?.partNumber) {
        body.push(`<p class="chapter-num">${String(section.partNumber).padStart(2, '0')}</p>`);
      }
      body.push(`<h1>${xml(section?.title ?? doc.data.title)}</h1>`);
      if (section?.blurb) body.push(`<p class="chapter-blurb">${xml(section.blurb)}</p>`);
      body.push('</div>');
      body.push(doc.html);
      body.push('</section>');
      continue;
    }

    body.push(
      `<section class="doc${doc.data.pageType === 'interlude' ? ' interlude' : ''}" id="doc-${xml(doc.data.docSlug)}">${doc.html}</section>`,
    );
  }

  const html = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8" />
<title>${xml(`${BOOK.title} (${BOOK.volume})`)}</title>
<style>${fonts}</style>
<style>${css}</style>
</head>
<body>
${body.join('\n')}
</body>
</html>`;

  return { html, documents, outline };
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

  const { html, outline } = await buildHtml();
  const htmlPath = path.join(WORK, 'libro.html');
  await writeFile(htmlPath, html, 'utf8');
  console.log(`HTML de impresión → ${path.relative(ROOT, htmlPath)} (${(Buffer.byteLength(html) / 1024).toFixed(0)} kB)`);

  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
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
      return { markers: out, height: document.documentElement.scrollHeight };
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

    await stamp(bytes, markers, outline);
  } finally {
    await browser.close();
  }
}

/** Adds page numbers, the outline and the document metadata. */
async function stamp(bytes, { markers, height }, outline) {
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

  // The cover and the back-cover text are front matter and carry no folio;
  // numbering starts with the contents page and runs to the end.
  const FIRST_NUMBERED = 2;
  let printed = 0;

  for (let i = FIRST_NUMBERED; i < pages.length; i += 1) {
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
  const pageOf = (offset) =>
    Math.min(pages.length - 1, Math.max(0, Math.floor((offset / height) * pages.length)));

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
