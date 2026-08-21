# Spec 05 — Separadores en las ediciones digitales

**Ediciones afectadas:** sitio, EPUB
**Origen:** especificaciones02.md, «Para el libro digital creo que habría poner algo separadores claros, para que las transiciones entre notas y secciones sean más visibles» y «Insertar separadores claros / entre notas»
**Depende de:** [spec 02](spec-02-titulacion-y-jerarquia.md)

## 1. Problema observado

En papel, el cambio de texto es evidente: hay un salto de página. En pantalla no
hay página, y el lector pasa de una crónica a la siguiente sin registrar el
cambio.

Estado verificado:

- **Sitio.** El libro es un único scroll continuo (`src/pages/index.astro`). Los
  documentos se suceden como `<article class="doc reader">` sin ninguna marca
  entre uno y otro más allá del espaciado. Sumado a la falta de títulos visibles
  ([RF-02.2](spec-02-titulacion-y-jerarquia.md)), las transiciones son invisibles.
- **EPUB.** Cada documento sí es un XHTML propio, de modo que la transición entre
  documentos existe. Lo que no está marcado es la transición **dentro** de un
  documento: las crónicas viven como `h2` dentro de un mismo archivo —
  `06-cronicas-una-casa-con-una-sala-negra.md`, `10-cronicas-violencia-sexual.md`
  y `12-cronicas-desaparecer.md` reúnen decenas de crónicas cada uno.
- El único recurso disponible hoy es la regla `hr`
  (`scripts/build-epub.mjs:76`, `src/styles/print.css:80-86`).

## 2. Requisitos

### RF-05.1 — Separador entre documentos en el sitio

Entre un documento y el siguiente, el sitio muestra una marca de transición
inequívoca. Debe cumplir:

- Ser perceptible sin depender del color: se ve en escala de grises.
- No sugerir el fin del libro.
- Adaptarse al tono de la sección en curso (ver
  [spec 07](spec-07-paleta-cromatica.md)).

Se admite como solución un filete corto centrado con espacio en blanco generoso a
ambos lados, del tipo del `hr` ya definido, más el título del documento entrante
—que la spec 02 vuelve visible.

### RF-05.2 — Separador entre crónicas

Dentro de los documentos que reúnen varias crónicas, cada nueva crónica lleva su
propia marca de comienzo, además del `h2`.

Aplica a: `cronicas-una-casa-con-una-sala-negra`, `cronicas-violencia-sexual`,
`cronicas-desaparecer`, y a cualquier documento cuyo cuerpo tenga más de un `h2`.

En el sitio y en el EPUB. En el PDF esta transición ya la resuelve la paginación.

### RF-05.3 — Marca de cambio de parte

El paso de una parte a otra —las cinco partes más el anexo— se distingue de un
simple cambio de documento:

- **Sitio:** la apertura de sección ya cumple esta función; se refuerza con el
  cambio de tono de la spec 07.
- **EPUB:** cada parte abre con un documento propio de portadilla de parte
  (número de parte y título), en lugar de la etiqueta `part-label` que hoy se
  antepone al primer documento (`scripts/build-epub.mjs:229-233`). Ese documento
  entra al lomo y a la navegación.

### RF-05.4 — El separador no rompe la accesibilidad ni la búsqueda

- Los separadores son decorativos: `role="presentation"` o `aria-hidden`, sin
  texto alternativo.
- No interfieren con el índice de Pagefind del sitio ni con `data-pagefind-body`.
- No alteran los ids de ancla existentes.

### RF-05.5 — El EPUB conserva su reflujo

Nada de lo anterior introduce alturas fijas, posicionamiento absoluto ni unidades
de viewport en el CSS del EPUB. La premisa de la edición —el sistema de lectura
es dueño de la página— no se toca.

## 3. Criterios de aceptación

- **CA-05.1** — En el sitio, al desplazarse de un documento al siguiente, hay una
  marca visible de transición además del texto.
- **CA-05.2** — En el sitio y en el EPUB, cada crónica de los tres documentos
  compilatorios arranca con una marca de comienzo.
- **CA-05.3** — En el EPUB, cada una de las cinco partes tiene un documento de
  portadilla propio, presente en el lomo y en `nav.xhtml`.
- **CA-05.4** — Los separadores no aportan texto al índice de búsqueda ni son
  anunciados por un lector de pantalla.
- **CA-05.5** — El EPUB sigue validando y se reflowea correctamente al rotar un
  teléfono.

## 4. Impacto técnico

| Archivo | Cambio |
|---------|--------|
| `src/pages/index.astro` | Separador entre documentos |
| `src/components/SplitReader.astro` | Marca de comienzo de crónica |
| `src/styles/book.css` | Estilos de separador |
| `scripts/build-epub.mjs` | Portadillas de parte; separadores entre crónicas |
| `scripts/build-epub.mjs` (`STYLES`) | Estilos de separador reflowables |
