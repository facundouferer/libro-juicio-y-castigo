# Cuarta revisión editorial (v1.3) — diagramación de libro impreso

Fuente: `docs/cambios_1_oct_2026.md`. Rama: `feat/cuarta-revision-editorial` (desde `origin/main`).

## Objetivo

Llevar el libro a una diagramación editorial apta para imprenta y encuadernación: grilla de línea base, márgenes espejados, jerarquía tipográfica constante, imágenes por escala (ficha 50 % / caja 100 % / dúo / grilla 2×2 / plano en impar) ancladas a cabeza o pie, preliminares y carátulas limpias. Aplicar los cambios de contenido y jerarquía también al sitio y al EPUB.

## Decisiones del usuario (2026-10-01)

- Las referencias de página del documento no coinciden con ningún PDF publicado (308/322/351 págs.); las primeras tandas usan el folio impreso (= página PDF − 6). Se aplican las **reglas generales y el catálogo de imágenes** a todo el libro; las tandas se verifican por contenido (imagen/título), no por número de página.
- Fotos: **bloque al final de cada crónica** (se mantiene `.tail-figures`), ordenado con grilla, módulos y escalas, anclado a cabeza o pie de página.
- El PDF **se imprime y encuaderna**: márgenes espejados (lomo más ancho).
- Sitio y EPUB: solo cambios de contenido/jerarquía (portadilla, firmas, carátula, índice sin imagen, escalas 50/100, dúos, grilla 2×2, estilos uniformes). Grilla base, impares, blancos, pliegos y lomo: solo PDF.
- Imprenta: criterio propio → PDF de imprenta aparte (A5 + 3 mm de sangrado, marcas de corte, total múltiplo de 16) no publicado; PDF de descarga A5 limpio con la misma diagramación.
- Por defecto: cuerpo 9,6 pt sobre renglón de 12,5 pt (130 %); portadilla con título agrandado + logo CPM, sin imagen.
- Implementar directo, sin specs previas.

## Alcance

- `src/styles/print.css`, `scripts/build-pdf.mjs` (PDF), `src/lib/image-format.mjs`, `src/lib/rehype-anchor-images.mjs`, `scripts/manifest.mjs`, nuevo catálogo de escalas en `src/data/`, componentes del sitio (`PartCover.astro`, `Interlude.astro`, `SplitReader.astro`, `Landing.astro`), `src/styles/book.css`, `scripts/build-epub.mjs`.
- Fuera de alcance: cambios de texto de las crónicas; publicación (push/PR) sin pedido del usuario.

## Checks aplicables

TDD: off (sin configuración ni runner de tests en el proyecto). Checks funcionales: `npm run build`, `npm run check`, `npm run pdf`, `npm run epub`, `npm run downloads`, revisión visual por hojas de contacto del PDF.

## Tareas

- [x] **T1 — Catálogo de escalas de imagen** (todas las ediciones). Archivo de datos con la categoría de cada imagen según el documento (ficha 50 %, caja 100 %, dúo 042/043, 061/062, 018bis/018bisbis; grilla 2×2 052–055; plano en impar 021, 095); `image-format.mjs` lo usa como fuente de verdad; módulos dúo y 2×2 en rehype; estilos en sitio, EPUB y PDF.
- [x] **T2 — Preliminares y carátulas** (todas las ediciones). Portadilla sin imagen y título agrandado; citas en mitad superior con firmas más grandes; firma «Por organismos de DDHH de CPM Chaco» antes del texto y más grande; firma de Gonzalo Torres más grande; sin imagen en el índice; carátulas de parte sin número «01» ni copete; verso de carátula en blanco (PDF).
- [x] **T3 — Caja, márgenes y grilla de línea base** (PDF). Márgenes espejados; renglón único de 12,5 pt; todos los espacios verticales, títulos, epígrafes y alturas de imagen en múltiplos del renglón; eliminar variantes de interlineado `is-tight/is-loose`; bajada de cabeza fija (25 %) en aperturas; distancia idéntica de títulos de sección que abren página; viudas/huérfanas para igualar el pie.
- [x] **T4 — Bloque de fotos anclado** (PDF). Imágenes del final de crónica en módulos de la grilla, ancladas a cabeza o pie, sin «isletas» centradas; planos/infografías en página impar dedicada; alineación especular en pliegos.
- [x] **T5 — PDF de imprenta** (PDF). Sangrado 3 mm, marcas de corte, TrimBox/BleedBox, total múltiplo de 16 con blancos de cortesía.
- [ ] **T6 — Regenerar ediciones y verificar**. PDF, EPUB y descargas; verificación por contenido de cada tanda del documento; `npm run build` y `npm run check`.

## Progreso y evidencia

- **T1** (commit 2fa5857, ruta: delegated direct, writer trigger: 2+ non-trivial files). Catálogo `src/data/image-scale.json` (105 claves: 051 no figura en el documento, asignada como caja por orientación; 061/062 están descartadas por duplicadas de 018bis/018bisbis, así que los dúos activos son 018bis+018bisbis y 042+043). `image-format.mjs` lee el catálogo (`box-ficha`/`box-caja`/`box-plano`); rehype agrupa dúos y grilla 2x2 (`.fig-module .fig-duo|.fig-grid2x2`); la grilla 052–055 que el mapa dejó en crónicas distintas se reúne en la crónica de su primer miembro. `promoteLastFigure` desactivado (sin isletas; la paridad la absorben blancos hasta T4). Checks: `npm run build` ok; `npm run pdf` ok (duo Morel/Ayala y grilla EAAF verificados visualmente); `npm run epub` ok.
- **T2** (commit a19984b, misma ruta). Portadilla 34/28 pt sin imagen (ya no tenía); citas arriba con firmas 10,5 pt; firmas de la Editorial e Introducción 11 pt (PDF), mayores en sitio y EPUB; carátulas de parte sin número ni copete en PDF, sitio y EPUB; verso en blanco en el PDF y foto de la parte al final del texto de apertura. La foto 001 (vereda del TOF), al final de la Editorial, se deja: el índice no tiene imagen y T4 la ancla al pie al 100 %. Checks: `npm run build` ok; `npm run check` ok salvo el manifiesto de descargas desfasado (se regenera en T6 con `npm run downloads`); `npm run pdf` 343 págs., aperturas en impar 57/57; `npm run epub` ok.

- **T3 + T4** (commit 3b3673d, ruta: delegated direct, writer trigger: 2+ non-trivial files; un solo commit porque el pase de maquetación sirve a ambas). Caja 40 × 12,5 pt = 500 pt (cabeza 42 pt, pie 53 pt), márgenes espejados 18 mm lomo / 13 mm corte (caja de 117 mm), bajada de cabeza 10 renglones (25 %), sangría de párrafo en vez de espacio, títulos con padding (no margin) para que arranquen igual; sin `is-tight/is-loose` (colas cortas: viuda larga o último párrafo entero). `scripts/lib/print-layout.mjs` simula la paginación (multicolumna), ajusta figuras a múltiplos del renglón y arma grupos anclados (pie del texto o cabeza de página propia; planos en impar con blanco interno; grilla 2×2 en página propia). Marcadores del índice y folios (centrados en la caja) salen del plan. Checks: `npm run build` ok; `npm run pdf` 322 págs. (antes 343), aperturas en impar 57/57, sin colas < 5 líneas, 0 avisos de simulación; 5526 líneas de cuerpo, 0 fuera de grilla; 94 págs. de texto terminan en la última línea base, 38 cortan a media lectura (1–3 renglones por viudas/huérfanas 2 y títulos pegados al texto; 1 de 8 por nota al pie); `npm run epub` ok.

- **T4, corrección tras revisión** (commit fix(pdf)): las figuras que quedaban dentro del texto (002, 037, 066, 078, 083, 084, 094, 095, 096, 098, 099, 100) pasan al bloque de fotos de su bloque; las fichas consecutivas se emparejan en un dúo; dos cajas que no entran juntas comparten página si sus imágenes ceden como máximo un 25 %; en dúo y grilla la imagen llena la celda (50 % del ancho menos medio gutter). PDF 316 págs. (antes 322), aperturas en impar 57/57, 0 líneas fuera de grilla, 0 avisos de simulación; páginas solo de figura por debajo del 50 %: 10 → 5. Hojas: scratchpad book_0..7.png.

- **T4, correcciones 2** (commit b4bf82c): el `height` del atributo `<img>` dejaba un hueco entre imagen y epígrafe en 75 figuras (ahora 0, `height:auto`); la ficha conserva el 50 % sin tope por calidad; la grilla 2×2 usa un marco de imagen igual en todas las celdas. PDF 296 págs., aperturas en impar 57/57, 0 líneas fuera de grilla, 95 págs. de texto terminan en la última línea base.
- **T5** (commit feat(pdf), misma ruta). `scripts/build-imprenta.mjs` (`npm run pdf:imprenta`) → `build/imprenta/…-imprenta.pdf` (no publicado): hoja 174 × 236 mm, TrimBox A5, BleedBox +3 mm, marcas de corte 0,25 pt fuera del sangrado, 296 págs. + 8 blancas = 304 (múltiplo de 16). Verificado con `pdfinfo -box` y render de la esquina. El fondo es blanco: no hay arte a sangre que extender.

## Próximo paso

T6.
