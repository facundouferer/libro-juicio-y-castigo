/**
 * Turns the proposed image anchors into the map the site, the PDF and the EPUB
 * all build against.
 *
 * The proposals are read as suggestions, not as truth. Each one is checked
 * against the real heading index, and where several readers converged on the
 * same obvious heading — the one naming the witness or the hearing date — the
 * contest is resolved by placement rather than by discarding a photograph:
 *
 *   1. the proposed heading, if it still has room
 *   2. the nearest heading with room in the same document
 *   3. the nearest document with room in the same section
 *   4. the section's closing gallery
 *
 * A heading's room is derived from how much text follows it. A chronicle with
 * twenty paragraphs can carry a sequence of photographs that the plate advances
 * through as the reader scrolls; a two-paragraph note cannot, and crowding it
 * would put four images on one screen of text.
 *
 * The output carries a `review` list — every anchor a person should look at,
 * least certain first. That list is the deliverable for the editorial pass.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'data');
const PROPOSALS = path.join(ROOT, 'scripts', 'proposed-anchors.json');

/** Below this, an anchor is placed but flagged for a human to confirm. */
const REVIEW_BELOW = 70;
/** Roughly how many paragraphs a heading needs before it can carry one more image. */
const BLOCKS_PER_IMAGE = 4;
/** No heading holds more than this, however long it runs. */
const MAX_PER_HEADING = 4;

const { entries, sections } = JSON.parse(await readFile(path.join(DATA, 'headings.json'), 'utf8'));
const captions = JSON.parse(await readFile(path.join(DATA, 'captions.json'), 'utf8'));

const docs = new Map(entries.map((e) => [e.slug, e]));
const headingText = new Map(entries.flatMap((e) => e.headings.map((h) => [`${e.slug}#${h.slug}`, h.text])));
const allKeys = captions.images.map((c) => c.key);
const captionByKey = new Map(captions.images.map((c) => [c.key, c]));

/** Documents of each section, in reading order — the spill path. */
const sectionDocs = new Map();
for (const entry of entries) {
  if (!sectionDocs.has(entry.section)) sectionDocs.set(entry.section, []);
  sectionDocs.get(entry.section).push(entry.slug);
}

const capacity = new Map();
const used = new Map();
for (const entry of entries) {
  for (const heading of entry.headings) {
    const slot = `${entry.slug}#${heading.slug}`;
    capacity.set(slot, Math.max(1, Math.min(MAX_PER_HEADING, Math.ceil(heading.blocks / BLOCKS_PER_IMAGE))));
    used.set(slot, 0);
  }
}

const room = (slot) => (capacity.get(slot) ?? 0) - (used.get(slot) ?? 0) > 0;
const take = (slot) => used.set(slot, (used.get(slot) ?? 0) + 1);

if (!existsSync(PROPOSALS)) {
  throw new Error(
    `Falta ${path.relative(ROOT, PROPOSALS)}. Ese archivo lo escribe la pasada de mapeo con los anclajes propuestos.`,
  );
}

const proposals = JSON.parse(await readFile(PROPOSALS, 'utf8'));
const rawMatches = Array.isArray(proposals) ? proposals : (proposals.matches ?? []);

/** anchors[doc][heading] is an ordered list — the plate advances through it. */
const anchors = {};
const documentImages = {};
const galleries = {};
const review = [];
const rejected = [];
const relocated = [];

const placedKeys = new Set();

/** Nearest heading with room in a document, searching forward before back. */
function nearestFree(docSlug, headingSlug) {
  const order = docs.get(docSlug)?.headings.map((h) => h.slug) ?? [];
  const start = order.indexOf(headingSlug);
  if (start === -1) return order.find((h) => room(`${docSlug}#${h}`)) ?? null;

  for (let step = 1; step < order.length; step += 1) {
    for (const index of [start + step, start - step]) {
      if (index < 0 || index >= order.length) continue;
      if (room(`${docSlug}#${order[index]}`)) {
        return order[index];
      }
    }
  }
  return null;
}

/** Nearest document with room in the same section. */
function nearestDoc(docSlug) {
  const doc = docs.get(docSlug);
  const siblings = sectionDocs.get(doc.section) ?? [];
  const start = siblings.indexOf(docSlug);

  for (let step = 1; step < siblings.length; step += 1) {
    for (const index of [start + step, start - step]) {
      if (index < 0 || index >= siblings.length) continue;
      const candidate = siblings[index];
      const heading = nearestFree(candidate, '');
      if (heading) return { docSlug: candidate, headingSlug: heading };
    }
  }
  return null;
}

// Highest confidence first, so the best-argued reading gets its first choice
// and the weaker ones do the moving.
const sorted = [...rawMatches].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

for (const match of sorted) {
  const key = String(match.imageKey ?? '').trim();
  const proposedDoc = String(match.documentSlug ?? '').trim();
  const proposedHeading = String(match.headingSlug ?? '').trim();
  const confidence = Number(match.confidence ?? 0);
  const reasoning = String(match.reasoning ?? '').trim();

  const fail = (why) => rejected.push({ key, docSlug: proposedDoc, headingSlug: proposedHeading, why });

  if (!captionByKey.has(key)) {
    fail('la imagen no existe');
    continue;
  }
  if (placedKeys.has(key)) {
    fail('la imagen ya estaba anclada con más confianza');
    continue;
  }
  if (!docs.has(proposedDoc)) {
    fail('el documento no existe');
    continue;
  }

  let docSlug = proposedDoc;
  let headingSlug = proposedHeading;
  let move = null;

  // A chapter opening or an interlude carries a single photograph.
  if (!headingSlug && !documentImages[docSlug]) {
    documentImages[docSlug] = key;
    placedKeys.add(key);
  } else {
    if (headingSlug && !capacity.has(`${docSlug}#${headingSlug}`)) {
      fail('el título no existe en ese documento');
      continue;
    }

    if (!headingSlug || !room(`${docSlug}#${headingSlug}`)) {
      const within = nearestFree(docSlug, headingSlug);
      if (within) {
        move = { kind: 'título', from: headingSlug || '(documento)', to: within };
        headingSlug = within;
      } else {
        const elsewhere = nearestDoc(docSlug);
        if (elsewhere) {
          move = { kind: 'documento', from: `${docSlug}#${headingSlug || '(documento)'}`, to: `${elsewhere.docSlug}#${elsewhere.headingSlug}` };
          docSlug = elsewhere.docSlug;
          headingSlug = elsewhere.headingSlug;
        } else {
          // Nothing left in the section: the image closes it as a plate.
          const section = docs.get(docSlug).section;
          galleries[section] ??= [];
          galleries[section].push(key);
          placedKeys.add(key);
          move = { kind: 'galería', from: `${docSlug}#${headingSlug || '(documento)'}`, to: `galería de ${section}` };
          headingSlug = null;
        }
      }
    }

    if (headingSlug) {
      take(`${docSlug}#${headingSlug}`);
      anchors[docSlug] ??= {};
      anchors[docSlug][headingSlug] ??= [];
      anchors[docSlug][headingSlug].push(key);
      placedKeys.add(key);
    }
  }

  if (move) relocated.push({ key, ...move });

  // A relocated anchor is by construction less certain than the reading that
  // produced it, so it goes to review whatever its original confidence.
  if (confidence < REVIEW_BELOW || move) {
    review.push({
      key,
      caption: captionByKey.get(key)?.caption?.slice(0, 110) ?? '',
      docSlug,
      headingSlug,
      heading: headingSlug ? (headingText.get(`${docSlug}#${headingSlug}`) ?? '') : move?.kind === 'galería' ? '(galería de sección)' : '(documento entero)',
      confidence: move ? Math.min(confidence, 55) : confidence,
      reasoning: move
        ? `${reasoning} — Reubicada por falta de lugar: se movió de ${move.from} a ${move.to}.`
        : reasoning,
    });
  }
}

const unplaced = allKeys.filter((key) => !placedKeys.has(key));
for (const key of unplaced) {
  review.push({
    key,
    caption: captionByKey.get(key)?.caption?.slice(0, 110) ?? '',
    docSlug: null,
    headingSlug: null,
    heading: '(sin ubicar)',
    confidence: 0,
    reasoning: 'La pasada de mapeo no propuso ubicación para esta imagen.',
  });
}

review.sort((a, b) => a.confidence - b.confidence);

const galleryCount = Object.values(galleries).reduce((n, g) => n + g.length, 0);

await writeFile(
  path.join(DATA, 'image-map.json'),
  `${JSON.stringify(
    {
      note: 'Generado por scripts/build-image-map.mjs a partir de scripts/proposed-anchors.json. `anchors[documento][título]` es la secuencia de imágenes que la placa va pasando mientras se lee ese título. `document` ancla una imagen a un documento entero (aperturas e interludios). `galleries` reúne las que cierran una sección. `review` es la lista que conviene que revise una persona, de menor a mayor confianza.',
      generated: {
        images: allKeys.length,
        placed: placedKeys.size,
        relocated: relocated.length,
        inGalleries: galleryCount,
        needsReview: review.length,
      },
      anchors,
      document: documentImages,
      galleries,
      review,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`Imágenes:          ${allKeys.length}`);
console.log(`Ancladas:          ${placedKeys.size}`);
console.log(`  a un título:     ${placedKeys.size - Object.keys(documentImages).length - galleryCount}`);
console.log(`  a un documento:  ${Object.keys(documentImages).length}`);
console.log(`  en galería:      ${galleryCount}`);
console.log(`Reubicadas:        ${relocated.length}`);
console.log(`Para revisar:      ${review.length}`);
if (rejected.length) {
  console.log(`\nRechazadas (${rejected.length}):`);
  for (const r of rejected.slice(0, 10)) console.log(`  ${r.key} → ${r.docSlug} — ${r.why}`);
}
if (unplaced.length) console.log(`\nSin ubicar (${unplaced.length}): ${unplaced.join(', ')}`);
console.log(`\nMapa → src/data/image-map.json`);
