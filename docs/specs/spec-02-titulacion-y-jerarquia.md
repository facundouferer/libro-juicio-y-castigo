# Spec 02 — Titulación y jerarquía tipográfica

**Ediciones afectadas:** sitio, PDF, EPUB
**Origen:** especificaciones02.md, secciones «1) Títulos», el pasaje sobre «Una casa con una sala negra» y el resumen «[ DOCUMENTO INICIAL ]» / «[ NOTAS & CRÓNICAS ]»

## 1. Problema observado

Cuatro fallas distintas, todas de jerarquía:

**a) Desproporción en la tapa.** El título aplasta al subtítulo.
`src/styles/print.css:138-150`: `h1` a 30 pt contra `.sub` a 12 pt — una relación
de 2,5 : 1. En el EPUB, `scripts/build-epub.mjs:104-110`: 2,1 em contra 1,02 em.

**b) Faltan títulos de documento.** «La memoria y la palabra: los juicios al
genocidio» e «Introducción» no se ven. Causa verificada: el normalizador promueve
el encabezado del cuerpo al frontmatter (`strip: 1` en `scripts/manifest.mjs`),
pero **ni el sitio ni el PDF lo vuelven a imprimir**:

- `src/components/SplitReader.astro:34` usa `title` sólo como `aria-label`.
- `scripts/build-pdf.mjs:133-135` emite `<section class="doc">${doc.html}</section>`
  sin ningún encabezado.
- `scripts/build-epub.mjs:236` sí lo imprime. Es la única edición donde el título
  sobrevive.

**c) La apertura de sección es confusa.** En «Una casa con una Sala Negra» se
imprime el título de la sección como encabezado principal, debajo el copete de la
sección —«Las crónicas y los textos que aluden a las denuncias…», que es
`SECTIONS[1].blurb` en `scripts/manifest.mjs:25-32`— y recién después el texto,
cuyo propio título quedó eliminado (`strip: 2`). El lector entiende que el texto
se titula «Una casa…» y que el copete es parte de la crónica.

**d) Notas al pie sobredimensionadas.** En
`src/content/book/04-tres-procesos-un-juicio-y-castigo.md:57-61` las notas están
escritas como `***texto***` (negrita + cursiva). Al no existir un estilo de nota,
se imprimen al cuerpo del texto general: 9,6 pt en negrita cursiva justificada.

## 2. Requisitos

### RF-02.1 — Proporción entre título y subtítulo de tapa

`CAUSA BRIGADA I, II, III` es tipografía prominente, no una línea de apoyo.

- La relación entre el cuerpo del título principal y el del subtítulo **no supera
  2 : 1** en ninguna edición.
- Referencia para A5: título 26 pt, subtítulo 15 pt.
- El subtítulo conserva su caja alta, su familia (`Oswald`) y su tracking.
- La bajada («Crónicas, dibujos y fotografías») queda por debajo del subtítulo en
  jerarquía y no se agranda.

Aplica a la tapa del sitio (`src/components/Landing.astro`), a la portadilla del
PDF y a la portadilla del EPUB.

### RF-02.2 — Todo documento imprime su título

Cada documento del libro renderiza su `title` como encabezado visible al inicio,
en las tres ediciones. Esto incluye explícitamente:

- «La memoria y la palabra: los juicios al genocidio»
- «Introducción»
- y los 18 documentos restantes de tipo `reader`.

En el sitio se resuelve en `SplitReader.astro`; en el PDF, en el armado de
`scripts/build-pdf.mjs`. El EPUB ya cumple.

El encabezado impreso debe usar el mismo id de ancla que ya consume el índice
interno del PDF (`doc-${docSlug}`) y la navegación del EPUB.

### RF-02.3 — Excepciones explícitas al título visible

Tres documentos no llevan título visible, porque su `title` es una etiqueta
interna y no un título editorial:

| Documento | Motivo |
|-----------|--------|
| `tapa` | La portadilla compone su propia titulación |
| `primera-pagina` | Es la página de citas; «Primera página» no es un título |
| `chachi` | El cuerpo ya abre con su título completo: «CHACHI. Gregorio "Chachi" Quintana 1955-2010» |
| El documento de créditos (spec 01) | Lleva su propio encabezado de legales |

La excepción se declara en `scripts/manifest.mjs` con una propiedad explícita
(por ejemplo `showTitle: false`), no por listas dispersas en cada generador.

### RF-02.4 — Jerarquía de la apertura de sección

En las cinco aperturas de parte, la jerarquía se invierte respecto de la actual:

```
volanta   ›  UNA CASA CON UNA SALA NEGRA     (título de la sección, cuerpo menor)
título    ›  En el lugar sin límites          (título del texto, cuerpo mayor)
texto     ›  Al comienzo no supo dónde estaba…
```

- El título de la sección pasa a **volanta**: caja alta, cuerpo menor que el
  título del texto, sin competir con él.
- El título del documento es el encabezado dominante de la página.
- El número de parte (`01`…`05`) se mantiene como marca de la parte.

Aplica a las cinco aperturas: `en-el-lugar-sin-limites`,
`de-victimas-a-sobrevivientes`, `desaparecer`,
`una-patota-para-la-miseria-planificada` y `condenados`.

### RF-02.5 — El copete de sección sale de la página de apertura

Los `blurb` de `SECTIONS` dejan de imprimirse en la apertura de sección en las
tres ediciones. Siguen siendo metadatos útiles para el índice, la navegación y
la descripción de la página, pero no son texto de página.

Puntos a modificar: `src/components/ChapterOpening.astro:52`,
`scripts/build-pdf.mjs:126` y `scripts/build-epub.mjs:232`.

### RF-02.6 — Estilo propio para notas al pie

Las notas al pie se marcan semánticamente y se componen con estilo propio:

- Cuerpo menor que el texto general: referencia 7,6 pt en A5, `0,82 em` en EPUB
  y sitio.
- Redonda, no negrita, no cursiva. La negrita cursiva actual se elimina.
- Alineación a la izquierda, sin justificar, sin partición de palabras.
- Separadas del cuerpo por un filete corto.
- El bloque no se parte entre páginas si mide menos de media página.

Alcance del contenido: el bloque `NOTAS PIE DE PÁGINA` de
`04-tres-procesos-un-juicio-y-castigo.md:57-61` y cualquier otro bloque de notas
que la revisión de contenido detecte con el mismo patrón.

> Nota: el marcado `***…***` se usa además en el cuerpo de
> `16-carcel-comun.md` y `20-los-fallos.md` como destacado legítimo. El cambio de
> estilo **no** puede aplicarse al patrón `***` en general: requiere marcar las
> notas de forma diferenciada en el markdown de origen.

### RF-02.7 — El documento inicial se identifica como institucional

> «No queda claro de entrada que las primeras páginas constituyen un documento
> institucional elaborado por los organismos de DDHH (CPM Chaco).»

«La memoria y la palabra: los juicios al genocidio» lleva, sobre su título, una
volanta institucional que lo identifica como lo que es:

```
volanta   ›  DECLARACIÓN / EDITORIAL DE LOS ORGANISMOS DE DERECHOS HUMANOS — CPM CHACO
título    ›  La memoria y la palabra: los juicios al genocidio
```

La volanta se compone en cuerpo menor y caja alta, con el mismo tratamiento que
la volanta de sección de RF-02.4. La redacción exacta la confirma el equipo
editorial; el original dice «Declaración / Editorial de Organismos de DDHH -
CPM Chaco».

La volanta se declara en `scripts/manifest.mjs` como propiedad del documento
(por ejemplo `kicker`), disponible para las tres ediciones.

## 3. Criterios de aceptación

- **CA-02.1** — En las tres tapas, el cociente entre el cuerpo del título y el del
  subtítulo es ≤ 2,0.
- **CA-02.2** — En el PDF y en el sitio, los textos «La memoria y la palabra: los
  juicios al genocidio» e «Introducción» aparecen como encabezado visible al
  inicio de su documento.
- **CA-02.3** — Los 24 documentos del libro imprimen su título salvo los cuatro
  declarados en RF-02.3, y esa lista está declarada en el manifiesto.
- **CA-02.4** — En la apertura de la primera parte, «En el lugar sin límites» se
  compone con un cuerpo mayor que «Una casa con una Sala Negra».
- **CA-02.5** — La cadena «Las crónicas y los textos que aluden a las denuncias»
  no aparece en ninguna página del PDF, del EPUB ni del sitio.
- **CA-02.6** — Las notas al pie de «Tres procesos, un juicio y castigo» se
  imprimen en cuerpo menor, en redonda y sin negrita.
- **CA-02.7** — El documento «La memoria y la palabra» abre con una volanta que
  lo identifica como declaración editorial de los organismos de DDHH — CPM Chaco.

## 4. Impacto técnico

| Archivo | Cambio |
|---------|--------|
| `scripts/manifest.mjs` | Propiedades `showTitle` y `kicker`; revisión de los `blurb` |
| `src/components/SplitReader.astro` | Imprimir el título del documento |
| `src/components/ChapterOpening.astro` | Volanta + título; quitar el copete |
| `scripts/build-pdf.mjs` | Encabezado por documento; jerarquía de apertura |
| `scripts/build-epub.mjs` | Jerarquía de apertura; quitar `part-blurb` |
| `src/styles/print.css` | Tapa, apertura, notas al pie |
| `src/styles/book.css` | Título de documento, volanta, notas al pie |
| `src/content/book/04-…md` | Marcado diferenciado del bloque de notas |
