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

const ROOT = path.resolve(import.meta.dirname, '..');
const EPUB_IMAGES = path.join(ROOT, 'build', 'epub');
const OUT_DIR = path.join(ROOT, 'public', 'descargas');
const OUT = path.join(OUT_DIR, 'juicio-y-castigo-en-el-chaco-vol-2.epub');

/**
 * A stable identifier. A random UUID would change on every build and make each
 * rebuild look like a different work to a library or a reading system.
 */
const BOOK_ID = 'urn:uuid:8a1d4f22-6c3b-5e7a-9d10-juicioycastigo2';

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
h1 { font-size: 1.5em; color: #145575; margin-top: 0; }
h2 { font-size: 1.22em; color: #145575; }
h3 { font-size: 1.06em; }
h4 { font-size: 0.98em; }

p { margin: 0 0 0.7em; text-indent: 0; }

blockquote {
  margin: 1.2em 0 1.2em 1em;
  padding-left: 0.9em;
  border-left: 3px solid #9fcde3;
  font-size: 0.94em;
}
blockquote p:last-child { margin-bottom: 0; }

hr { border: 0; height: 2px; background: #9fcde3; width: 30%; margin: 1.8em auto; }

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
figure.figure figcaption .credit { display: block; font-weight: bold; color: #196b93; }

.cover-page { text-align: left; margin-top: 18%; }
.cover-page h1 { font-size: 2.1em; line-height: 1.12; color: #1e81b0; }
.cover-page .sub {
  font-family: sans-serif;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 1.02em;
  margin: 0.8em 0 0.2em;
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
  color: #196b93;
  margin: 0 0 0.3em;
  text-align: left;
}
.part-blurb { font-style: italic; color: #575d63; margin-bottom: 1.4em; }

nav[epub|type~='toc'] ol { list-style: none; padding-left: 1em; }
nav[epub|type~='toc'] > ol { padding-left: 0; }
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
  <h1>${xml(BOOK.title)}<br />${xml(BOOK.volume)}</h1>
  <p class="sub">${xml(BOOK.subtitle)}</p>
  <p class="kicker">${xml(BOOK.kicker)}</p>
  <p class="publisher">${xml(BOOK.publisher)}</p>
</section>`,
    ),
  });

  const cover = documents.find((d) => d.data.pageType === 'landing');
  if (cover?.html) {
    chapters.push({
      id: 'contratapa',
      file: 'text/001-sobre-este-libro.xhtml',
      title: 'Sobre este libro',
      depth: 0,
      content: xhtml('Sobre este libro', `<section><h1>Sobre este libro</h1>${toXhtml(cover.html)}</section>`),
    });
  }

  let index = 2;
  let lastSection = null;

  for (const doc of documents) {
    if (doc.data.pageType === 'landing') continue;

    const section = sectionById.get(doc.data.section);
    const parts = [];

    // A part label opens the first document of each movement, so the reader
    // knows where they are without a separate divider file.
    if (doc.data.section !== lastSection && section?.part) {
      parts.push(`<p class="part-label">${xml(section.part)} — ${xml(section.title)}</p>`);
      if (section.blurb) parts.push(`<p class="part-blurb">${xml(section.blurb)}</p>`);
    }
    lastSection = doc.data.section;

    parts.push(`<h1>${xml(doc.data.title)}</h1>`);
    parts.push(toXhtml(doc.html));

    for (const match of doc.html.matchAll(/src="\.\.\/images\/([^"]+)"/g)) usedImages.add(match[1]);

    chapters.push({
      id: `c${String(index).padStart(3, '0')}`,
      file: `text/${String(index).padStart(3, '0')}-${doc.data.docSlug}.xhtml`,
      title: doc.data.title,
      section: doc.data.section,
      depth: 0,
      headings: doc.headings.filter((h) => h.depth === 2).slice(0, 40),
      content: xhtml(doc.data.title, `<section epub:type="chapter">\n${parts.join('\n')}\n</section>`),
    });
    index += 1;
  }

  for (const chapter of chapters) zip.file(`OEBPS/${chapter.file}`, chapter.content);

  // Only the images the book actually anchors are packaged; an unused
  // derivative would be dead weight on a phone.
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
    <li><a epub:type="bodymatter" href="${chapters[2]?.file ?? chapters[0].file}">Comienzo</a></li>
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
      (name, i) => `    <item id="img${String(i).padStart(3, '0')}" href="images/${name}" media-type="image/jpeg" />`,
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
    <dc:description>${xml(BOOK.description)}</dc:description>
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
