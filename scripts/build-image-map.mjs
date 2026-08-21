/**
 * Turns the proposed image anchors into the map the site, the PDF and the EPUB
 * all build against.
 *
 * The folder numbering is the book's visual score. The editorial team numbered
 * the 105 photographs and drawings in the order they are meant to appear, and
 * that order outranks any resemblance between an epigraph and a heading. So the
 * allocator walks the images in folder order and never looks backwards: image
 * 042 can only land at or after wherever 041 landed.
 *
 * Semantic affinity still has a job, but a smaller one. A proposal is honoured
 * only when it falls inside the gap the order already leaves — between where
 * the previous image landed and where the next one will. Most proposals do not,
 * and that is the trade the spec asks for: see
 * docs/specs/spec-04-secuencia-de-imagenes.md, RF-04.1 and RF-04.2, and the
 * note at the foot of that document about what it costs.
 *
 * Pacing is measured in capacity, not in slots. Four documents hold 206 of the
 * book's 241 headings, so spacing the images evenly across headings would empty
 * the short documents and crowd the chronicles. Capacity follows the text.
 *
 * A heading's room is derived from how much text follows it. A chronicle with
 * twenty paragraphs can carry a sequence of photographs that the plate advances
 * through as the reader scrolls; a two-paragraph note cannot, and crowding it
 * would put four images on one screen of text.
 *
 * Two lists come out alongside the map: `review`, the inventory of where every
 * image ended up, and a duplicates report for the editorial pass to act on.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'data');
const BUILD = path.join(ROOT, 'build');
const PROPOSALS = path.join(ROOT, 'scripts', 'proposed-anchors.json');
const SKIP_FILE = path.join(ROOT, 'scripts', 'image-skip.json');

/** Below this, the proposal that placed an image is worth a second look. */
const REVIEW_BELOW = 70;
/** Roughly how many paragraphs a heading needs before it can carry one more image. */
const BLOCKS_PER_IMAGE = 4;
/** No heading holds more than this, however long it runs. */
const MAX_PER_HEADING = 4;

/**
 * Documents that never carry a photograph, whatever the mapping proposes.
 * `tapa` composes its own art; `primera-pagina` is the citations page and
 * `creditos` the colophon, both of which spec 01 requires to stay typographic.
 *
 * Leaving `creditos` out of this list put image 001 on the credits page, where
 * no edition renders it — so the photograph vanished from the book without any
 * check noticing, because the map still counted it as placed.
 */
const NO_IMAGE_DOCS = new Set(['tapa', 'primera-pagina', 'creditos']);

const { entries } = JSON.parse(await readFile(path.join(DATA, 'headings.json'), 'utf8'));
const captions = JSON.parse(await readFile(path.join(DATA, 'captions.json'), 'utf8'));

if (!existsSync(PROPOSALS)) {
  throw new Error(
    `Falta ${path.relative(ROOT, PROPOSALS)}. Ese archivo lo escribe la pasada de mapeo con los anclajes propuestos.`,
  );
}
const proposals = JSON.parse(await readFile(PROPOSALS, 'utf8'));
const rawMatches = Array.isArray(proposals) ? proposals : (proposals.matches ?? []);

/** Images the editorial pass decided not to print. See RF-04.4. */
const skipConfig = existsSync(SKIP_FILE) ? JSON.parse(await readFile(SKIP_FILE, 'utf8')) : { skip: [] };
const skipReason = new Map((skipConfig.skip ?? []).map((s) => [String(s.key).trim(), String(s.reason ?? '')]));

const captionByKey = new Map(captions.images.map((c) => [c.key, c]));
const headingText = new Map(entries.flatMap((e) => e.headings.map((h) => [`${e.slug}#${h.slug}`, h.text])));

/** The images to place, in folder order, minus the ones the editors dropped. */
const orderedKeys = captions.images.map((c) => c.key).filter((key) => !skipReason.has(key));

/* ── The slot list ──────────────────────────────────────────────────────────
   Every place an image can go, in reading order. Index into this array is the
   only notion of "position" the allocator has, and it only ever moves forward. */

const slots = [];

/** Openings and interludes carry one photograph for the whole document, and so
 *  does any document with no headings of its own — the plate's resting state. */
const carriesDocumentImage = (entry) =>
  !NO_IMAGE_DOCS.has(entry.slug) &&
  entry.pageType !== 'landing' &&
  (entry.pageType === 'chapter-opening' || entry.pageType === 'interlude' || entry.headings.length === 0);

for (const entry of entries) {
  if (carriesDocumentImage(entry)) {
    slots.push({ docSlug: entry.slug, headingSlug: null, section: entry.section, capacity: 1, used: 0 });
  }
  if (NO_IMAGE_DOCS.has(entry.slug)) continue;
  for (const heading of entry.headings) {
    slots.push({
      docSlug: entry.slug,
      headingSlug: heading.slug,
      section: entry.section,
      capacity: Math.max(1, Math.min(MAX_PER_HEADING, Math.ceil(heading.blocks / BLOCKS_PER_IMAGE))),
      used: 0,
    });
  }
}

const slotIndex = new Map(slots.map((s, i) => [`${s.docSlug}#${s.headingSlug ?? ''}`, i]));
const room = (i) => i >= 0 && i < slots.length && slots[i].used < slots[i].capacity;

/* ── Allocation ─────────────────────────────────────────────────────────────
   Folder order in, monotonic positions out.

   Every slot contributes as many "units" as it has room for, so the book turns
   into one flat ribbon of `totalCapacity` places measured in text rather than
   in headings. Image i takes the unit at (i + ½) · totalCapacity / n. That is
   strictly increasing, so the sequence can never double back, and it is evenly
   spread by construction, so no document is crowded while another runs blank —
   the two failures the first draft of this allocator produced.

   Two passes refine the result without breaking either property, because both
   stay inside the gap left by the image before and the image after:
     · openings and interludes claim the image passing closest to them
     · a proposal is honoured when it falls inside that same gap */

const units = [];
for (let i = 0; i < slots.length; i += 1) {
  for (let n = 0; n < slots[i].capacity; n += 1) units.push(i);
}
const totalCapacity = units.length;

const proposalOf = new Map();
for (const match of rawMatches) {
  const key = String(match.imageKey ?? '').trim();
  const doc = String(match.documentSlug ?? '').trim();
  const heading = String(match.headingSlug ?? '').trim();
  const index = slotIndex.get(`${doc}#${heading}`);
  proposalOf.set(key, {
    index: index ?? -1,
    confidence: Number(match.confidence ?? 0),
    reasoning: String(match.reasoning ?? '').trim(),
    proposed: `${doc}#${heading || '(documento)'}`,
  });
}

const n = orderedKeys.length;
/** Pass 1 — the evenly spread baseline. */
const assigned = orderedKeys.map((_, i) => units[Math.min(units.length - 1, Math.floor(((i + 0.5) * totalCapacity) / n))]);

/** The room an image has to move without overtaking either neighbour. */
const lowerBound = (i) => (i === 0 ? 0 : assigned[i - 1]);
const upperBound = (i) => (i === n - 1 ? slots.length - 1 : assigned[i + 1]);

let plated = 0;
/** Pass 2 — openings and interludes show one photograph for the whole document,
 *  and the layouts fall back to a bare title page without one. */
const taken = new Set();
for (let d = 0; d < slots.length; d += 1) {
  if (slots[d].headingSlug !== null) continue;
  let best = -1;
  for (let i = 0; i < n; i += 1) {
    if (taken.has(i)) continue;
    if (d < lowerBound(i) || d > upperBound(i)) continue;
    if (best === -1 || Math.abs(assigned[i] - d) < Math.abs(assigned[best] - d)) best = i;
  }
  if (best === -1) continue;
  assigned[best] = d;
  taken.add(best);
  plated += 1;
}

let honoured = 0;
/** Pass 3 — semantic affinity, but only inside the gap the order already left. */
for (let i = 0; i < n; i += 1) {
  if (taken.has(i)) continue;
  const proposal = proposalOf.get(orderedKeys[i]);
  if (!proposal || proposal.index < 0) continue;
  if (proposal.index === assigned[i]) {
    honoured += 1;
    continue;
  }
  if (proposal.index < lowerBound(i) || proposal.index > upperBound(i)) continue;
  if (slots[proposal.index].headingSlug === null) continue;
  assigned[i] = proposal.index;
  honoured += 1;
}

const anchors = {};
const documentImages = {};
const review = [];
const placement = [];

orderedKeys.forEach((key, i) => {
  const slot = slots[assigned[i]];
  const proposal = proposalOf.get(key) ?? { index: -1, confidence: 0, reasoning: '', proposed: '(sin propuesta)' };

  if (slot.headingSlug === null) {
    documentImages[slot.docSlug] = key;
  } else {
    anchors[slot.docSlug] ??= {};
    anchors[slot.docSlug][slot.headingSlug] ??= [];
    anchors[slot.docSlug][slot.headingSlug].push(key);
  }

  placement.push({ key, index: assigned[i], docSlug: slot.docSlug, headingSlug: slot.headingSlug });

  const moved = proposal.index !== assigned[i];
  if (proposal.confidence < REVIEW_BELOW || moved) {
    review.push({
      key,
      caption: captionByKey.get(key)?.caption?.slice(0, 110) ?? '',
      docSlug: slot.docSlug,
      headingSlug: slot.headingSlug,
      heading: slot.headingSlug
        ? (headingText.get(`${slot.docSlug}#${slot.headingSlug}`) ?? '')
        : '(documento entero)',
      confidence: moved ? Math.min(proposal.confidence, 55) : proposal.confidence,
      reasoning: moved
        ? `${proposal.reasoning} — Reubicada para respetar el orden de carpeta: se propuso ${proposal.proposed}.`
        : proposal.reasoning,
    });
  }
});

const paced = n - honoured - plated;

review.sort((a, b) => a.confidence - b.confidence);

/* ── Monotonicity check (RF-04.3) ───────────────────────────────────────── */

const regressions = [];
for (let i = 1; i < placement.length; i += 1) {
  if (placement[i].index < placement[i - 1].index) {
    regressions.push({ key: placement[i].key, after: placement[i - 1].key });
  }
}

/* ── Duplicates report (RF-04.4) ────────────────────────────────────────── */

const normalise = (text) =>
  String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP = new Set('de la el los las en y a del un una con por para su sus al es que se o e'.split(' '));
const tokensOf = (text) => new Set(normalise(text).split(' ').filter((w) => w.length > 2 && !STOP.has(w)));

const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
};

/**
 * Institutions, places and roles that are capitalised all over the epigraphs.
 * Counting them as names made every photograph taken at the Brigada look like a
 * duplicate of every other one.
 */
const NOT_A_PERSON = new Set(
  ('brigada investigaciones chaco resistencia alcaidia inspeccion senalizacion prensa gentileza ' +
   'causa tribunal argentina estado policia ejercito diario region audiencia juicio memoria ' +
   'comision provincial dibujo archivo plano planta sotanos federal nacion unidad plaza catedral ' +
   'julio junio agosto marzo abril mayo enero febrero septiembre octubre noviembre diciembre').split(' '),
);

/** Capitalised runs read as proper names — enough to catch two portraits of the
 *  same person filed under different numbers. */
const namesOf = (text) =>
  new Set(
    (String(text ?? '').match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\b/g) ?? [])
      .map((w) => normalise(w))
      .filter((w) => w.length > 3 && !NOT_A_PERSON.has(w)),
  );

const duplicates = [];
const all = captions.images;
for (let i = 0; i < all.length; i += 1) {
  for (let j = i + 1; j < all.length; j += 1) {
    const a = all[i];
    const b = all[j];
    if (!a.caption || !b.caption) continue;

    const identical = normalise(a.caption) === normalise(b.caption);
    const similarity = jaccard(tokensOf(a.caption), tokensOf(b.caption));
    const namesA = namesOf(a.caption);
    const namesB = namesOf(b.caption);
    const sharedNames = [...namesA].filter((n) => namesB.has(n));

    let why = null;
    if (identical) why = 'epígrafe idéntico';
    else if (similarity >= 0.7) why = `epígrafe muy similar (${Math.round(similarity * 100)} %)`;
    else if (sharedNames.length >= 3) why = `mismas personas nombradas: ${sharedNames.join(', ')}`;

    if (!why) continue;
    duplicates.push({
      keys: [a.key, b.key],
      why,
      captions: [a.caption, b.caption],
      placed: [
        placement.find((p) => p.key === a.key)?.docSlug ?? '(descartada)',
        placement.find((p) => p.key === b.key)?.docSlug ?? '(descartada)',
      ],
    });
  }
}

await mkdir(BUILD, { recursive: true });
await writeFile(
  path.join(BUILD, 'revision-duplicados.md'),
  [
    '# Imágenes candidatas a duplicado',
    '',
    'Generado por `scripts/build-image-map.mjs`. Cada par de abajo comparte epígrafe,',
    'vocabulario o las personas que nombra. **Ninguna se descarta automáticamente**: la',
    'decisión es editorial (spec 04, RF-04.4).',
    '',
    'Para descartar una imagen, agregala a `scripts/image-skip.json` con su motivo. El',
    'archivo de imagen no se borra: sólo se excluye de la colocación.',
    '',
    duplicates.length ? '' : '_No se detectaron pares candidatos._',
    ...duplicates.flatMap((d) => [
      `## \`${d.keys[0]}\` + \`${d.keys[1]}\` — ${d.why}`,
      '',
      `- \`${d.keys[0]}\` — ${d.captions[0]}`,
      `  <br>ubicada en: ${d.placed[0]}`,
      `- \`${d.keys[1]}\` — ${d.captions[1]}`,
      `  <br>ubicada en: ${d.placed[1]}`,
      '',
    ]),
  ].join('\n'),
  'utf8',
);

/* ── Output ─────────────────────────────────────────────────────────────── */

const placedCount = placement.length;

await writeFile(
  path.join(DATA, 'image-map.json'),
  `${JSON.stringify(
    {
      note: 'Generado por scripts/build-image-map.mjs a partir de scripts/proposed-anchors.json. Las imágenes se recorren en el orden de la carpeta y se ubican sin retroceder nunca (spec 04). `anchors[documento][título]` es la secuencia de imágenes que la placa va pasando mientras se lee ese título. `document` ancla una imagen a un documento entero (aperturas e interludios). `review` es el inventario de la colocación, de menor a mayor confianza.',
      generated: {
        images: captions.images.length,
        skipped: skipReason.size,
        placed: placedCount,
        onOpenings: plated,
        byAffinity: honoured,
        bySequence: paced,
        regressions: regressions.length,
        needsReview: review.length,
        duplicateCandidates: duplicates.length,
      },
      sequence: placement.map((p) => p.key),
      skipped: [...skipReason].map(([key, reason]) => ({ key, reason })),
      anchors,
      document: documentImages,
      review,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`Imágenes:            ${captions.images.length}`);
if (skipReason.size) console.log(`Descartadas:         ${skipReason.size} (${[...skipReason.keys()].join(', ')})`);
console.log(`Ubicadas:            ${placedCount}`);
console.log(`  en aperturas:      ${plated}`);
console.log(`  por afinidad:      ${honoured}`);
console.log(`  por secuencia:     ${paced}`);
console.log(`Saltos hacia atrás:  ${regressions.length}`);
console.log(`Para revisar:        ${review.length}`);
console.log(`Candidatas a duplicado: ${duplicates.length} → build/revision-duplicados.md`);

if (regressions.length) {
  console.error(`\nLa secuencia retrocede en ${regressions.length} ${regressions.length === 1 ? 'punto' : 'puntos'}:`);
  for (const r of regressions.slice(0, 10)) console.error(`  ${r.key} quedó antes que ${r.after}`);
  process.exit(1);
}

console.log(`\nMapa → src/data/image-map.json`);
