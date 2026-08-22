/**
 * Two inventories the editorial team has to be able to read without opening
 * code, because both encode a judgement that a rule made on their behalf.
 *
 *   build/revision-volantas.md  — which `h1` headings were read as the volanta
 *                                 of a chronicle and which were not (spec 04,
 *                                 RF-04.2)
 *   build/revision-formatos.md  — which container each of the 105 images was
 *                                 given (spec 07, RF-07.3)
 *
 * Both rules are heuristics over prose and over an archive assembled by hand
 * over fifteen years. Printing what they decided is what keeps a change to the
 * manuscript from silently changing the layout.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { isVolanta } from '../src/lib/cronicas.mjs';
import { containerFor, isDrawing } from '../src/lib/image-format.mjs';
import { FULL_PAGE_IMAGES, IMAGE_FORMAT, VOLANTA_OVERRIDE } from './manifest.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'data');
const BUILD = path.join(ROOT, 'build');

const { entries } = JSON.parse(await readFile(path.join(DATA, 'headings.json'), 'utf8'));
const captions = JSON.parse(await readFile(path.join(DATA, 'captions.json'), 'utf8'));
const images = JSON.parse(await readFile(path.join(DATA, 'images.json'), 'utf8'));
const map = JSON.parse(await readFile(path.join(DATA, 'image-map.json'), 'utf8'));

await mkdir(BUILD, { recursive: true });

/* ── Volantas ───────────────────────────────────────────────────────────── */

const h1s = [];
for (const entry of entries) {
  const list = entry.headings;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].depth !== 1) continue;
    h1s.push({
      doc: entry.slug,
      docTitle: entry.title,
      text: list[i].text,
      slug: list[i].slug,
      volanta: isVolanta(1, list[i].text, list[i].slug),
      forced: Object.hasOwn(VOLANTA_OVERRIDE, list[i].slug),
      title: list[i + 1]?.role === 'title' ? list[i + 1].text : null,
    });
  }
}

const volantas = h1s.filter((h) => h.volanta);
const plain = h1s.filter((h) => !h.volanta);
const alone = volantas.filter((h) => !h.title);

await writeFile(
  path.join(BUILD, 'revision-volantas.md'),
  [
    '# Volantas y titulares de crónica',
    '',
    'Generado por `scripts/report-layout.mjs`. El manuscrito escribe cada crónica',
    'como un par de títulos: la volanta (causa y fecha) en `h1` y el titular en `h2`.',
    'El nivel describe la estructura del documento, no la jerarquía visual, así que',
    'la maqueta lo lee al revés de como está escrito (spec 04, RF-04.1).',
    '',
    `**${volantas.length}** de los **${h1s.length}** encabezados de nivel 1 del libro se leyeron como volanta.`,
    '',
    'Para forzar o negar una clasificación, agregá el `id` del título a',
    '`VOLANTA_OVERRIDE` en `scripts/manifest.mjs`.',
    '',
    '## Volantas de crónica',
    '',
    '| Documento | Volanta | Titular |',
    '|-----------|---------|---------|',
    ...volantas.map(
      (h) =>
        `| ${h.docTitle} | ${h.text}${h.forced ? ' _(forzada)_' : ''} | ${h.title ?? '_(abre sin titular)_'} |`,
    ),
    '',
    `### Volantas sin titular: ${alone.length}`,
    '',
    'La volanta abre la crónica sola y el texto arranca debajo. Ocurre cuando el',
    'manuscrito no escribió un `h2` inmediatamente después (RF-04.3).',
    '',
    ...alone.map((h) => `- ${h.docTitle} — ${h.text}`),
    '',
    '## `h1` que NO son volanta',
    '',
    ...(plain.length
      ? plain.map((h) => `- ${h.docTitle} — ${h.text}${h.forced ? ' _(negada a mano)_' : ''}`)
      : ['_Ninguno._']),
    '',
  ].join('\n'),
  'utf8',
);

/* ── Formatos de imagen ─────────────────────────────────────────────────── */

const captionByKey = new Map(captions.images.map((c) => [c.key, c]));
const skipped = new Set((map.skipped ?? []).map((s) => s.key));

const rows = captions.images.map((caption) => {
  const entry = images.content?.[caption.key] ?? {};
  return {
    key: caption.key,
    caption: caption.caption ?? '',
    orientation: entry.orientation ?? '—',
    quality: entry.printQuality ?? 'full',
    drawing: isDrawing(caption),
    container: containerFor(caption.key, entry, caption),
    forced: Boolean(IMAGE_FORMAT[caption.key]),
    skipped: skipped.has(caption.key),
  };
});

const placed = rows.filter((r) => !r.skipped);
const byContainer = placed.reduce((acc, r) => {
  acc[r.container] = (acc[r.container] ?? 0) + 1;
  return acc;
}, {});

const LABEL = {
  'box-full': 'Ancho de caja',
  'box-two-thirds': 'Dos tercios centrado',
  'box-page': 'Página completa',
};

await writeFile(
  path.join(BUILD, 'revision-formatos.md'),
  [
    '# Formato de cada imagen',
    '',
    'Generado por `scripts/report-layout.mjs`. Tres contenedores y ninguno más',
    '(spec 07, RF-07.1). La página completa está reservada a las carátulas de',
    'sección y a los planos del edificio (RF-07.4); el resto se asigna por',
    'orientación y por lo que dice el epígrafe.',
    '',
    'Para cambiar el contenedor de una imagen, agregá su clave a `IMAGE_FORMAT`',
    'en `scripts/manifest.mjs` con el contenedor que corresponda.',
    '',
    '## Reparto',
    '',
    '| Contenedor | Imágenes |',
    '|------------|----------|',
    ...Object.entries(LABEL).map(([id, label]) => `| ${label} (\`${id}\`) | ${byContainer[id] ?? 0} |`),
    `| _Descartadas_ | ${rows.length - placed.length} |`,
    '',
    '## Inventario',
    '',
    '| Clave | Contenedor | Orientación | Calidad | Epígrafe |',
    '|-------|------------|-------------|---------|----------|',
    ...rows.map(
      (r) =>
        `| \`${r.key}\`${r.forced ? ' ⚙' : ''}${r.skipped ? ' ✕' : ''} | ${LABEL[r.container]} | ${r.orientation}${r.drawing ? ' · dibujo' : ''} | ${r.quality} | ${(r.caption || '_(sin epígrafe)_').replace(/\|/g, '\\|').slice(0, 110)} |`,
    ),
    '',
    '⚙ contenedor forzado a mano · ✕ imagen descartada en `scripts/image-skip.json`',
    '',
  ].join('\n'),
  'utf8',
);

console.log(`Volantas de crónica: ${volantas.length} de ${h1s.length} h1  (${alone.length} sin titular)`);
console.log(`Formatos de imagen:  ${Object.entries(byContainer).map(([k, n]) => `${LABEL[k]} ${n}`).join(' · ')}`);
if (FULL_PAGE_IMAGES.size !== (byContainer['box-page'] ?? 0)) {
  const missing = [...FULL_PAGE_IMAGES].filter((k) => skipped.has(k));
  if (missing.length) console.log(`  (${missing.length} reservadas a página completa están descartadas: ${missing.join(', ')})`);
}
console.log(`\nInformes → build/revision-volantas.md · build/revision-formatos.md`);
