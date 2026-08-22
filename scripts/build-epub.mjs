/**
 * Builds the EPUB 3 edition.
 *
 * Written directly rather than through a converter: the book is 24 documents
 * with a known structure, and hand-assembling the container means the reading
 * order, the navigation document and the image sizing are exactly what a phone
 * or an e-reader needs — which is the one thing the spec asks of this format.
 *
 * Reflowable throughout. Images are the flat 1400 px derivatives, sized in
 * percentages so they scale to whatever screen opens them.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderBook, xml } from './lib/render-book.mjs';
import { SECTIONS } from './manifest.mjs';
import { BOOK } from '../src/lib/site.mjs';
import { ACCENT, ACCENT_BASE, SECTION_STEP, SMALL_TEXT_STEP } from '../src/lib/palette.mjs';
import { containerFor } from '../src/lib/image-format.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const EPUB_IMAGES = path.join(ROOT, 'build', 'epub');
const OUT_DIR = path.join(ROOT, 'public', 'descargas');
const OUT = path.join(OUT_DIR, 'juicio-y-castigo-en-el-chaco-vol-2.epub');

/**
 * A stable identifier. A random UUID would change on every build and make each
 * rebuild look like a different work to a library or a reading system.
 */
const BOOK_ID = 'urn:uuid:8a1d4f22-6c3b-5e7a-9d10-juicioycastigo2';

/** Which edition of the book this is (specs-v12, spec 09, RF-09.3). */
const VERSION = JSON.parse(
  await readFile(path.join(path.resolve(import.meta.dirname, '..'), 'package.json'), 'utf8'),
).version.replace(/\.0$/, '');

/**
 * Per-section tone. The EPUB gets resolved colours rather than custom
 * properties: reading systems vary in what they support, and a colour that
 * silently fails to resolve would take the titling with it. The values still
 * come from src/lib/palette.mjs, so there is only one definition (RF-07.2).
 */
const SECTION_RULES = Object.entries(SECTION_STEP)
  .map(
    ([id, step]) => `[data-section="${id}"] h1, [data-section="${id}"] h2, [data-section="${id}"] .part-label,
[data-section="${id}"] .part-title { color: ${ACCENT[step]}; }`,
  )
  .join('\n');

const STYLES = `@charset "utf-8";

/* Reflowable throughout: no fixed widths, no absolute positioning, nothing
   that assumes a screen size. The reading system owns the page. */

body {
  margin: 0 5%;
  font-family: serif;
  font-size: 1em;
  line-height: 1.5;
  text-align: justify;
  hyphens: auto;
  -epub-hyphens: auto;
  widows: 2;
  orphans: 2;
}

h1, h2, h3, h4 {
  font-family: sans-serif;
  font-weight: bold;
  text-transform: uppercase;
  line-height: 1.15;
  text-align: left;
  hyphens: none;
  -epub-hyphens: none;
  page-break-after: avoid;
  break-after: avoid;
  margin: 1.4em 0 0.5em;
}
h1 { font-size: 1.5em; color: ${ACCENT[700]}; margin-top: 0; }
h2 { font-size: 1.22em; color: ${ACCENT[700]}; }
h3 { font-size: 1.06em; }
h4 { font-size: 0.98em; }

p { margin: 0 0 0.7em; text-indent: 0; }

blockquote {
  margin: 1.2em 0 1.2em 1em;
  padding-left: 0.9em;
  border-left: 3px solid ${ACCENT[300]};
  font-size: 0.94em;
}
blockquote p:last-child { margin-bottom: 0; }

hr { border: 0; height: 2px; background: ${ACCENT[300]}; width: 30%; margin: 1.8em auto; }

/* Images stay inside the screen no matter how the reader rotates it. The
   spec accepts that photographs are the one thing a phone renders small. */
figure.figure {
  margin: 1.4em 0;
  text-align: center;
  page-break-inside: avoid;
  break-inside: avoid;
}
figure.figure img {
  max-width: 100%;
  max-height: 88vh;
  width: auto;
  height: auto;
}
figure.figure figcaption {
  margin-top: 0.4em;
  font-size: 0.76em;
  line-height: 1.35;
  text-align: left;
  color: #575d63;
  hyphens: none;
  -epub-hyphens: none;
}
figure.figure figcaption .credit { display: block; font-weight: bold; color: ${ACCENT[SMALL_TEXT_STEP]}; }

.cover-page { text-align: left; margin-top: 6%; }
.cover-photo { display: block; width: 100%; height: auto; margin-bottom: 1.4em; }
.cover-page h1 { font-size: 2.4em; line-height: 1.1; color: ${ACCENT_BASE}; }
.cover-page .sub {
  font-family: sans-serif;
  font-weight: bold;
  text-transform: uppercase;
  /* «Causa Brigada I, II, III» names what the volume is about; at 1.15em it
     read as a footnote to the title instead of as its second half
     (specs-v12, spec 01, RF-01.2). 2.4/1.5 = 1.6:1. */
  font-size: 1.5em;
  line-height: 1.16;
  margin: 0.7em 0 0.3em;
  color: ${ACCENT[700]};
}
.cover-page .kicker { font-style: italic; color: #575d63; }
.cover-page .publisher {
  margin-top: 3em;
  font-family: sans-serif;
  text-transform: uppercase;
  font-size: 0.78em;
  letter-spacing: 0.06em;
  color: #575d63;
}

.part-label {
  font-family: sans-serif;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 0.82em;
  letter-spacing: 0.08em;
  color: ${ACCENT[SMALL_TEXT_STEP]};
  margin: 0 0 0.3em;
  text-align: left;
}
/* ── The opening of a chronicle (specs-v12, spec 04) ────────────────────────
   The volanta is written as a level-1 heading and the headline as a level-2
   one, so sizing by level set the volanta larger than the title it introduces.
   1.62em against 0.78em: a ratio of 2.1. */
.cronica-head { display: block; margin: 2em 0 0.9em; }
.cronica-volanta {
  font-family: sans-serif;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 0.78em;
  letter-spacing: 0.1em;
  line-height: 1.3;
  color: ${ACCENT[SMALL_TEXT_STEP]};
  margin: 0 0 0.4em;
  text-align: left;
}
h2.cronica-title { font-size: 1.62em; line-height: 1.1; margin: 0; }
h2.cronica-title::before { content: none; }

/* The signature, under the title and before the first paragraph, so the voice
   is identified from the start (specs-v12, spec 02, RF-02.1). */
.doc-byline {
  font-family: sans-serif;
  text-transform: uppercase;
  font-size: 0.8em;
  letter-spacing: 0.07em;
  color: ${ACCENT[SMALL_TEXT_STEP]};
  margin: 0.5em 0 1.2em;
  text-align: left;
}

/* What stays at the foot: the roll of organisations, the date. */
aside.signoff {
  margin-top: 2em;
  padding-top: 0.8em;
  border-top: 1px solid #d9dcdf;
  page-break-inside: avoid;
  break-inside: avoid;
}
aside.signoff p {
  font-size: 0.88em;
  line-height: 1.45;
  text-align: left;
  hyphens: none;
  -epub-hyphens: none;
  color: #3d4247;
  margin: 0 0 0.35em;
}
aside.signoff .signoff-lead { color: ${ACCENT[SMALL_TEXT_STEP]}; margin-bottom: 0.8em; }

/* ── Image containers (specs-v12, spec 07, RF-07.7) ─────────────────────────
   The three containers of the printed edition, translated to a reflowable
   medium: full width, two thirds centred, and the whole width of the view. */
figure.figure.box-two-thirds { width: 66%; margin-left: auto; margin-right: auto; }
figure.figure.box-full img, figure.figure.box-page img { width: 100%; height: auto; }
figure.figure.box-full figcaption { text-align: right; }
figure.figure.box-page { page-break-before: always; break-before: page; }
.doc-kicker {
  font-family: sans-serif;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 0.8em;
  letter-spacing: 0.08em;
  color: ${ACCENT[SMALL_TEXT_STEP]};
  margin: 0 0 0.4em;
  text-align: left;
}

/* Footnotes: notes, not body copy (spec 02, RF-02.6). */
aside.footnotes {
  margin-top: 2em;
  padding-top: 0.8em;
  border-top: 1px solid #d9dcdf;
  page-break-inside: avoid;
  break-inside: avoid;
}
aside.footnotes p {
  font-size: 0.82em;
  line-height: 1.45;
  font-style: normal;
  font-weight: normal;
  text-align: left;
  hyphens: none;
  -epub-hyphens: none;
  color: #3d4247;
}
aside.footnotes .footnotes-title {
  font-family: sans-serif;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 0.78em;
  letter-spacing: 0.06em;
  color: ${ACCENT[SMALL_TEXT_STEP]};
  margin-bottom: 0.4em;
}

/* ── Separators (spec 05) ───────────────────────────────────────────────────
   Drawn as rules so they read in greyscale, and as ::before pseudo-elements so
   nothing is added to the document a reading system has to reflow. */

h1.doc-title::before {
  content: '';
  display: block;
  width: 3em;
  border-top: 3px solid ${ACCENT[500]};
  margin-bottom: 0.8em;
}
h1:not(.doc-title)::before {
  content: '';
  display: block;
  border-top: 1px solid #d9dcdf;
  margin-bottom: 0.9em;
}
h2::before {
  content: '';
  display: block;
  width: 1.6em;
  border-top: 2px solid ${ACCENT[300]};
  margin-bottom: 0.5em;
}

.part-divider { margin-top: 22%; text-align: left; }
.part-divider .part-num {
  font-family: sans-serif;
  font-weight: bold;
  font-size: 3.2em;
  line-height: 1;
  color: ${ACCENT[200]};
  margin: 0 0 0.2em;
}
.part-divider .part-title { font-size: 2.1em; line-height: 1.06; margin: 0 0 0.7em; }
.part-divider .part-title::before { content: none; }
.part-divider .part-blurb {
  font-size: 0.92em;
  line-height: 1.5;
  color: #3d4247;
  text-align: left;
  hyphens: none;
  -epub-hyphens: none;
}

nav[epub|type~='toc'] ol { list-style: none; padding-left: 1em; }
nav[epub|type~='toc'] > ol { padding-left: 0; }

/* One family, several intensities — the movement of the book (spec 07). */
${SECTION_RULES}
`;

const xhtml = (title, body, extraStyle = '') => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es-AR" lang="es-AR">
<head>
<meta charset="utf-8" />
<title>${xml(title)}</title>
<link rel="stylesheet" type="text/css" href="../styles/book.css" />${extraStyle}
</head>
<body>
${body}
</body>
</html>`;

/**
 * The rendered HTML is HTML5; the EPUB container demands well-formed XML.
 * Void elements have to self-close and bare attributes have to carry a value.
 */
function toXhtml(html) {
  return html
    .replace(/<(img|br|hr|source|meta|link)([^>]*?)\s*\/?>/g, (_, tag, attrs) => `<${tag}${attrs.replace(/\/$/, '')} />`)
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    .replace(/ (data-[a-z-]+|role|loading|decoding)="[^"]*"/g, '');
}

/** What each page type is, in the vocabulary a reading system understands. */
const EPUB_TYPE = {
  citations: 'epigraph',
  colophon: 'copyright-page',
  'chapter-opening': 'chapter',
  interlude: 'chapter',
  reader: 'chapter',
};

async function main() {
  if (!existsSync(EPUB_IMAGES)) {
    throw new Error('Faltan los derivados del EPUB. Corré primero: npm run images');
  }
  await mkdir(OUT_DIR, { recursive: true });

  const documents = await renderBook('epub');
  const sectionById = new Map(SECTIONS.map((s) => [s.id, s]));
  const zip = new JSZip();

  // The mimetype entry must be first and stored uncompressed — a reading
  // system identifies the container by reading it at a fixed byte offset.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`,
  );

  zip.file('OEBPS/styles/book.css', STYLES);

  const chapters = [];
  const usedImages = new Set();

  // 1 — cover
  chapters.push({
    id: 'cover',
    file: 'text/000-portada.xhtml',
    title: `${BOOK.title} (${BOOK.volume})`,
    depth: 0,
    content: xhtml(
      `${BOOK.title} (${BOOK.volume})`,
      `<section class="cover-page" epub:type="titlepage">
  <img class="cover-photo" src="../images/tapa.jpg" alt="" />
  <h1>${xml(BOOK.title)}<br />${xml(BOOK.volume)}</h1>
  <p class="sub">${xml(BOOK.subtitle)}</p>
  <p class="kicker">${xml(BOOK.kicker)}</p>
  <p class="publisher">${xml(BOOK.publisher)}</p>
</section>`,
    ),
  });

  const cover = documents.find((d) => d.data.pageType === 'landing');

  let index = 1;
  let lastSection = null;

  for (const doc of documents) {
    if (doc.data.pageType === 'landing') continue;

    const section = sectionById.get(doc.data.section);
    const parts = [];

    // Each part opens with a divider document of its own, so the change of
    // movement is a page a reader lands on rather than a line above a title
    // (spec 05, RF-05.3).
    if (doc.data.section !== lastSection && section?.part) {
      chapters.push({
        id: `part${String(index).padStart(3, '0')}`,
        file: `text/${String(index).padStart(3, '0')}-parte-${section.id}.xhtml`,
        title: `${section.part} — ${section.title}`,
        section: doc.data.section,
        pageType: 'part-divider',
        depth: 0,
        content: xhtml(
          `${section.part} — ${section.title}`,
          `<section epub:type="part" class="part-divider" data-section="${xml(section.id)}">
${section.partNumber ? `  <p class="part-num">${String(section.partNumber).padStart(2, '0')}</p>` : ''}
  <p class="part-label">${xml(section.part)}</p>
  <h1 class="part-title">${xml(section.title)}</h1>
${section.blurb ? `  <p class="part-blurb">${xml(section.blurb)}</p>` : ''}
</section>`,
        ),
      });
      index += 1;
    }
    lastSection = doc.data.section;

    // The name of the section used to print again here, as an overline above the
    // title of its opening text. It has a divider of its own now, so repeating
    // it said the same thing twice (specs-v12, spec 03, RF-03.5).
    if (doc.data.kicker) parts.push(`<p class="doc-kicker">${xml(doc.data.kicker)}</p>`);
    if (doc.data.showTitle !== false) parts.push(`<h1 class="doc-title">${xml(doc.data.title)}</h1>`);
    // Below the title and before the first paragraph (specs-v12, spec 02).
    if (doc.data.byline) parts.push(`<p class="doc-byline">${xml(doc.data.byline)}</p>`);

    // A document-wide photograph is bound to the document, not to a heading, so
    // the anchoring plugin never emits it and the EPUB used to drop it entirely
    // (spec 04, RF-04.6). It goes after the text, never between the title and
    // the first paragraph (specs-v12, spec 06, RF-06.3).
    const plateParts = [];
    if (doc.plate) {
      const caption = [
        doc.plate.caption ? xml(doc.plate.caption) : '',
        doc.plate.credit ? `<span class="credit">${xml(doc.plate.credit)}</span>` : '',
      ].join('');
      const box =
        doc.data.pageType === 'chapter-opening'
          ? 'box-page'
          : containerFor(doc.plate.key, doc.plate, { caption: doc.plate.caption });
      plateParts.push(
        [
          `<figure class="figure ${xml(box)}" id="fig-${xml(doc.plate.key)}">`,
          `<img src="../images/${xml(doc.plate.key)}.jpg" alt="${xml(doc.plate.alt)}" />`,
          caption ? `<figcaption>${caption}</figcaption>` : '',
          '</figure>',
        ].join(''),
      );
      usedImages.add(`${doc.plate.key}.jpg`);
    }
    parts.push(toXhtml(doc.html));
    parts.push(...plateParts);

    for (const match of doc.html.matchAll(/src="\.\.\/images\/([^"]+)"/g)) usedImages.add(match[1]);

    chapters.push({
      id: `c${String(index).padStart(3, '0')}`,
      file: `text/${String(index).padStart(3, '0')}-${doc.data.docSlug}.xhtml`,
      title: doc.data.title,
      section: doc.data.section,
      pageType: doc.data.pageType,
      depth: 0,
      headings: doc.headings.filter((h) => h.depth === 2).slice(0, 40),
      // `cronica` marks the headline of a chronicle; the volanta is no longer a
      // heading at all, so it cannot reach the navigation (specs-v12, spec 04).
      content: xhtml(
        doc.data.title,
        `<section epub:type="${EPUB_TYPE[doc.data.pageType] ?? 'chapter'}" data-section="${xml(doc.data.section)}">\n${parts.join('\n')}\n</section>`,
      ),
    });
    index += 1;
  }

  // Back-cover copy closes the book instead of opening it (spec 01, RF-01.3).
  if (cover?.html) {
    chapters.push({
      id: 'contratapa',
      file: `text/${String(index).padStart(3, '0')}-sobre-este-libro.xhtml`,
      title: 'Sobre este libro',
      depth: 0,
      content: xhtml(
        'Sobre este libro',
        `<section epub:type="backmatter"><h1>Sobre este libro</h1>${toXhtml(cover.html)}</section>`,
      ),
    });
    for (const match of cover.html.matchAll(/src="\.\.\/images\/([^"]+)"/g)) usedImages.add(match[1]);
  }

  for (const chapter of chapters) zip.file(`OEBPS/${chapter.file}`, chapter.content);

  // Only the images the book actually anchors are packaged; an unused
  // derivative would be dead weight on a phone.
  // The cover photograph is referenced by the title page, not by an anchor.
  usedImages.add('tapa.jpg');

  const available = new Set(await readdir(EPUB_IMAGES));
  let imageBytes = 0;
  const packaged = [];
  for (const name of [...usedImages].sort()) {
    if (!available.has(name)) continue;
    const data = await readFile(path.join(EPUB_IMAGES, name));
    zip.file(`OEBPS/images/${name}`, data);
    imageBytes += data.length;
    packaged.push(name);
  }

  /** Front matter ends where the first text of the book begins. */
  const bodyStart = chapters.find((c) => c.pageType && !['citations', 'colophon'].includes(c.pageType));

  // 2 — navigation document (EPUB 3)
  const navItems = chapters
    .map((chapter) => {
      const sub = chapter.headings?.length
        ? `\n      <ol>${chapter.headings
            .map((h) => `\n        <li><a href="${chapter.file}#${xml(h.id)}">${xml(h.text)}</a></li>`)
            .join('')}\n      </ol>\n    `
        : '';
      return `    <li><a href="${chapter.file}">${xml(chapter.title)}</a>${sub}</li>`;
    })
    .join('\n');

  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es-AR" lang="es-AR">
<head><meta charset="utf-8" /><title>Índice</title><link rel="stylesheet" type="text/css" href="styles/book.css" /></head>
<body>
<nav epub:type="toc" id="toc">
  <h1>Índice</h1>
  <ol>
${navItems}
  </ol>
</nav>
<nav epub:type="landmarks" hidden="hidden">
  <ol>
    <li><a epub:type="titlepage" href="text/000-portada.xhtml">Portada</a></li>
    <li><a epub:type="bodymatter" href="${bodyStart?.file ?? chapters[0].file}">Comienzo</a></li>
  </ol>
</nav>
</body>
</html>`,
  );

  // 3 — NCX, for readers that never moved past EPUB 2
  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="es-AR">
<head>
  <meta name="dtb:uid" content="${BOOK_ID}" />
  <meta name="dtb:depth" content="2" />
  <meta name="dtb:totalPageCount" content="0" />
  <meta name="dtb:maxPageNumber" content="0" />
</head>
<docTitle><text>${xml(`${BOOK.title} (${BOOK.volume})`)}</text></docTitle>
<navMap>
${chapters
  .map(
    (chapter, i) => `  <navPoint id="nav-${chapter.id}" playOrder="${i + 1}">
    <navLabel><text>${xml(chapter.title)}</text></navLabel>
    <content src="${chapter.file}" />
  </navPoint>`,
  )
  .join('\n')}
</navMap>
</ncx>`,
  );

  // 4 — package document
  const manifest = [
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />',
    '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />',
    '    <item id="css" href="styles/book.css" media-type="text/css" />',
    ...chapters.map((c) => `    <item id="${c.id}" href="${c.file}" media-type="application/xhtml+xml" />`),
    ...packaged.map(
      (name, i) =>
        `    <item id="img${String(i).padStart(3, '0')}" href="images/${name}" media-type="image/jpeg"${
          name === 'tapa.jpg' ? ' properties="cover-image"' : ''
        } />`,
    ),
  ].join('\n');

  const spine = chapters.map((c) => `    <itemref idref="${c.id}" />`).join('\n');
  const modified = new Date('2026-08-17T00:00:00Z').toISOString().replace(/\.\d{3}Z$/, 'Z');

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="es-AR">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${BOOK_ID}</dc:identifier>
    <dc:title>${xml(`${BOOK.title} (${BOOK.volume})`)}</dc:title>
    <dc:creator>${xml(BOOK.publisher)}</dc:creator>
    <dc:publisher>${xml(BOOK.publisher)}</dc:publisher>
    <dc:language>es-AR</dc:language>
    <dc:description>${xml(`${BOOK.description} Edición ${VERSION}.`)}</dc:description>
    <meta property="schema:version">${xml(VERSION)}</meta>
    <dc:subject>Crímenes de lesa humanidad</dc:subject>
    <dc:subject>Terrorismo de Estado</dc:subject>
    <dc:subject>Derechos humanos</dc:subject>
    <dc:subject>Chaco, Argentina</dc:subject>
    <dc:subject>Memoria, verdad y justicia</dc:subject>
    <meta property="dcterms:modified">${modified}</meta>
    <meta property="schema:accessibilitySummary">Texto completamente accesible. Las fotografías llevan como texto alternativo el epígrafe redactado por el archivo; las que el archivo no epigrafió se declaran decorativas en lugar de describirse por conjetura.</meta>
    <meta property="schema:accessMode">textual</meta>
    <meta property="schema:accessMode">visual</meta>
    <meta property="schema:accessibilityFeature">tableOfContents</meta>
    <meta property="schema:accessibilityFeature">readingOrder</meta>
    <meta property="schema:accessibilityFeature">alternativeText</meta>
  </metadata>
  <manifest>
${manifest}
  </manifest>
  <spine toc="ncx">
${spine}
  </spine>
</package>`,
  );

  const bytes = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    mimeType: 'application/epub+zip',
  });

  await writeFile(OUT, bytes);

  console.log(`Documentos: ${chapters.length}`);
  console.log(`Imágenes empaquetadas: ${packaged.length} (${(imageBytes / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`\nEPUB → ${path.relative(ROOT, OUT)}  (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`);
}

await main();
