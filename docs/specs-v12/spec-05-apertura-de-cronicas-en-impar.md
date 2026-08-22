# Spec 05 — Cada crónica abre en página impar

**Ediciones afectadas:** PDF A5 (la única con página física)
**Origen:** `especificaciones03.md`, sección «Títulos de crónicas y separaciones»
**Depende de:** [spec 04](spec-04-volanta-y-titular-de-cronica.md)

## 1. Problema observado

> «**Arranque de crónicas en páginas pares / a mitad de página:** Cada crónica es
> una unidad narrativa autónoma. Deben arrancar siempre en **página impar
> (derecha)** para darle peso de apertura, o al menos iniciar en tope de página,
> nunca en el medio de un bloque corrido. Todas en impar.
> A modo de ejemplo, en las páginas 47 49 89 79 94 hay crónicas que empiezan a
> final de página.
> La página 36 tiene una sola línea.»

La ronda anterior implementó la apertura en recto, pero con la unidad
equivocada. `scripts/build-pdf.mjs:333-343` (`planRecto`) trabaja sobre
**documentos**: hay 24, y tres de ellos —los tres archivos de crónicas— contienen
entre 4 y 13 crónicas cada uno. Dentro de un documento, las crónicas fluyen sin
control de paridad ni de posición: una crónica puede empezar en el último tercio
de un verso, que es justamente lo que la devolución señala en las páginas 47, 49,
79, 89 y 94.

La página 36 con una sola línea es el otro síntoma del mismo hueco: no hay
control de cuánto texto puede quedar solo en una página.

## 2. Requisitos

### RF-05.1 — La unidad de paginación es la crónica, no el documento

`planRecto` deja de operar sobre 24 documentos y pasa a operar sobre **bloques**,
donde un bloque es:

- un documento sin crónicas (los 21 restantes), o
- **cada crónica** de los documentos de crónicas, delimitada por su volanta
  (spec 04, RF-04.1).

Recuento esperado: 21 documentos + 34 crónicas + 5 carátulas de sección
(spec 03) ≈ 60 bloques a medir, contra los 24 de hoy.

### RF-05.2 — Todo bloque abre en recto

Sin excepción, en cumplimiento literal del «todas en impar». Cuando la medición
determina que un bloque caería en verso, se inserta una página delante.

### RF-05.3 — El verso que se inserta lleva imagen, no vacío

Decisión D2 del equipo editorial. La página insertada por RF-05.2 **no es un
blanco de cortesía**: es una página de imagen a página completa, tomada de las
imágenes que la crónica anterior no alcanzó a acomodar (spec 06, RF-06.4).

Sólo cuando no hay imagen disponible para ese hueco, la página queda como blanco
de cortesía: sin folio y sin ornamento, como los del frente.

### RF-05.4 — Ninguna página lleva menos de cinco líneas de texto

Ninguna página del libro puede contener menos de **cinco líneas** de texto de
cuerpo, salvo que sea una página de imagen, una carátula o un blanco de cortesía.
`orphans` y `widows` suben de 3 a 4, y la construcción del PDF reporta toda
página que quede por debajo del umbral.

Cuando una crónica deja una cola de menos de cinco líneas, la corrección
disponible sin tocar el texto es tipográfica: dejar que esa cola comparta página
con la imagen de cierre de la crónica (spec 06, RF-06.2).

### RF-05.5 — El informe declara lo que hizo

`npm run pdf` ya imprime un plan por bloque. Se extiende para informar, por
bloque: página de inicio, paridad, cantidad de páginas, y si hubo que insertar
una página delante, con qué se llenó (imagen o blanco). Al cierre: cuántos
bloques abren en impar sobre el total, cuántas páginas de imagen se insertaron,
cuántos blancos quedaron y qué páginas incumplen RF-05.4.

Un bloque que abra en verso mantiene el `process.exitCode = 1` que ya existe en
`scripts/build-pdf.mjs:453-459`.

### RF-05.6 — Coste de páginas aceptado

Se acepta el crecimiento del libro que esto implica. La medición previa a la
implementación deberá informarlo; la referencia es que el orden esperado son unas
30 páginas insertadas, en su mayoría con imagen.

## 3. Criterios de aceptación

- **CA-05.1** — `npm run pdf` informa «Aperturas en impar: N de N» con ambos
  números iguales, y termina con código de salida 0.
- **CA-05.2** — El plan impreso enumera ≈60 bloques, incluidas las 34 crónicas
  individuales con su titular.
- **CA-05.3** — Ninguna de las 34 crónicas empieza en una página par ni por debajo
  del tope de la caja de texto.
- **CA-05.4** — Toda página insertada por paridad es una página de imagen o un
  blanco sin folio; ninguna queda con folio impreso y sin contenido.
- **CA-05.5** — El informe de páginas cortas no lista ninguna página con menos de
  cinco líneas de cuerpo.
- **CA-05.6** — Las páginas 47, 49, 79, 89 y 94 de la edición anterior, ya
  desplazadas, no reproducen el defecto: ninguna crónica arranca a pie de página
  en todo el libro.

## 4. Archivos afectados

- `scripts/build-pdf.mjs:140-230` — trocear los documentos de crónicas en bloques.
- `scripts/build-pdf.mjs:296-345` — `measureBlocks` y `planRecto` sobre la nueva
  unidad; elección del relleno del verso.
- `scripts/build-pdf.mjs:440-500` — informes.
- `src/styles/print.css:35-45` — `orphans` / `widows` a 4.
