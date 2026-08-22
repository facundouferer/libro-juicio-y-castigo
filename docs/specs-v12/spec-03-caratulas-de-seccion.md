# Spec 03 — Carátula propia para cada sección

**Ediciones afectadas:** Sitio, PDF, EPUB
**Origen:** `especificaciones03.md`, sección «Contenido desubicado»
**Depende de:** —

## 1. Problema observado

> «El texto de apertura de "Una casa con una Sala Negra" mantiene el mismo
> problema que señalé: arranca con "En el lugar sin límites" directamente, sin la
> carátula de sección separando.»

La ronda anterior resolvió esto a medias. Hoy el PDF arma un único bloque
(`scripts/build-pdf.mjs:175-190`) en el que el nombre de la sección va como
**volanta** de 10 pt (`src/styles/print.css:337-346`) encima del título del texto
de apertura, a 22 pt. Es decir: «UNA CASA CON UNA SALA NEGRA» pequeñito, y «EN EL
LUGAR SIN LÍMITES» grande.

Ese fue un pedido de la ronda anterior (spec 02, RF-02.4 de `docs/specs/`) para
que el ensayo de apertura no pareciera no tener título. La solución elegida
—invertir la jerarquía en la misma página— resolvió un problema creando otro:
ahora es la sección la que no tiene carátula.

La solución correcta es que sean **dos páginas distintas**, no dos niveles de una
misma. El EPUB ya lo hace bien (`scripts/build-epub.mjs:327-345`: emite un
`part-divider` propio antes de cada sección); el PDF y el sitio no.

## 2. Requisitos

### RF-03.1 — Cada sección abre con su propia carátula

Antes del primer documento de cada una de las cinco partes, se emite una
**carátula de sección** independiente, que contiene y sólo contiene:

- el número de parte en romanos o en cifra («01» … «05»),
- el rótulo de la parte («PRIMERA PARTE» … «QUINTA PARTE»),
- el **título de la sección**, como pieza dominante de la página,
- opcionalmente el `blurb` de la sección, ya presente en `scripts/manifest.mjs:20-77`.

El título de la sección es la tipografía de mayor cuerpo de esa página. Nada
compite con él.

### RF-03.2 — El texto de apertura recupera su propia página y su propio título

«En el lugar sin límites», «De víctimas a sobrevivientes», «Desaparecer», «Una
patota para la miseria planificada» y «Condenados» dejan de compartir página con
el nombre de la sección. Cada uno empieza en su propia página, encabezado por su
título, sin volanta de sección encima.

La secuencia impresa de una parte queda así:

| Página | Contenido |
|--------|-----------|
| recto | **Carátula de sección**: parte, número, título de la sección, blurb |
| verso | Fotografía de la sección a página completa (spec 07, RF-07.4) |
| recto | Texto de apertura, con su propio título |

Esto reemplaza el «carátula · blanco de cortesía · texto» de la ronda anterior
(spec 03, RF-03.7 de `docs/specs/`): el verso ya no queda vacío, lo ocupa la
fotografía que hasta ahora iba arriba de la carátula.

### RF-03.3 — La carátula lleva el color de su sección

La carátula toma el `--section-accent` correspondiente, como el resto de la
sección (spec 07 de `docs/specs/`, ya implementada en `src/lib/palette.mjs`).

### RF-03.4 — En el sitio, la carátula es una vista propia

En la lectura continua del sitio, la carátula de sección es una `<section>` de
alto de pantalla con el mismo contenido, y el texto de apertura queda debajo como
documento independiente. El índice (`ContentsModal`) lista la sección y el texto
como dos entradas distintas.

### RF-03.5 — El EPUB conserva lo que ya hace, alineado al nuevo contenido

El `part-divider` del EPUB ya cumple RF-03.1. Se le agrega el número de parte y
el `blurb` para que las tres ediciones digan lo mismo, y se retira la
`opening-volanta` que `scripts/build-epub.mjs:349-351` sigue imprimiendo encima
del título del texto de apertura, que ahora es redundante.

## 3. Criterios de aceptación

- **CA-03.1** — El PDF contiene cinco páginas de carátula, una por parte, cada una
  en recto, y `npm run pdf` las lista en su informe de plan.
- **CA-03.2** — En `build/pdf/libro.html` no queda ninguna `.chapter-volanta`
  dentro del bloque de título del texto de apertura.
- **CA-03.3** — En la carátula, el cuerpo del título de sección es estrictamente
  mayor que el de cualquier otro elemento de esa página.
- **CA-03.4** — El texto de apertura de cada parte empieza en una página propia,
  encabezado por su título; ninguna de las cinco páginas de apertura contiene el
  nombre de la sección.
- **CA-03.5** — El índice del sitio y el del EPUB listan las cinco secciones como
  entradas propias, distintas de sus textos de apertura.
- **CA-03.6** — El EPUB no repite el nombre de la sección encima del título del
  texto de apertura.

## 4. Archivos afectados

- `scripts/build-pdf.mjs:167-199` — separar carátula y texto en dos bloques.
- `src/styles/print.css:320-348` — estilos de `.page-part` y baja de
  `.chapter-volanta`.
- `src/components/ChapterOpening.astro` — dividir en carátula + apertura.
- `src/pages/index.astro:60-66` — emitir la carátula antes del primer documento
  de cada sección.
- `scripts/build-epub.mjs:327-353` — número y blurb en `part-divider`; quitar
  `opening-volanta`.
- `src/styles/book.css` — estilos de la carátula en el sitio.
