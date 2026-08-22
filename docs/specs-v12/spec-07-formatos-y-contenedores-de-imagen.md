# Spec 07 — Formatos y contenedores de imagen

**Ediciones afectadas:** Sitio, PDF, EPUB
**Origen:** `especificaciones03.md`, secciones «Imágenes» y «Diseño y organización de las imágenes»
**Depende de:** [spec 06](spec-06-colocacion-de-imagenes.md)

## 1. Problema observado

> «Usa dos formatos según la imagen: Imagen a ancho completo de caja de texto —
> para fotografías de prensa, fotos grupales, fotos del tribunal o de la plaza.
> Ocupa todo el ancho de la página, con el epígrafe alineado abajo a la derecha
> en cuerpo menor. […] Es el formato dominante. Imagen a mitad o dos tercios de
> ancho — para retratos individuales, dibujos y fotografías de legajo.
> En el Vol 2 hay encuadres variables. Hay que unificar.»

> «**Página completa / A sangre:** Reservada exclusivamente para separadores de
> eje o imágenes de alto impacto conceptual.»

> «el dibujo de Ponti al no tener fondo y ponerlo con otra foto rectangular
> debajo fíjate que no queda bien, como que hay algo que hace ruido.»

Hoy el formato lo decide una sola línea
(`src/lib/rehype-anchor-images.mjs:229-231`): vertical y bien escaneada → página
completa; todo lo demás → media página. Con eso, unas 35 de las 105 imágenes se
van a página completa, cuando la devolución la reserva para un puñado. Y el ancho
real de cada figura queda librado a la proporción del archivo
(`src/styles/print.css:121-137` topa altura, no ancho), que es de donde salen los
«encuadres variables».

## 2. Requisitos

### RF-07.1 — Tres contenedores, y ninguno más

| Contenedor | Ocupación en A5 | Destino |
|------------|-----------------|---------|
| **Ancho de caja** (`box-full`) | 119 mm de ancho, alto libre hasta 105 mm | Fotografías de prensa, grupales, de tribunal, de plaza, documentos apaisados. **Formato dominante.** |
| **Dos tercios centrado** (`box-two-thirds`) | 79 mm de ancho, centrado, sin texto al costado | Retratos individuales, dibujos, fotografías de legajo |
| **Página completa** (`box-page`) | Toda la caja de 119 × 180 mm | Sólo lo que autoriza RF-07.4 |

No existe un cuarto formato ni tamaños intermedios. Ninguna figura lleva texto a
su costado en ninguna de las tres ediciones impresas o digitales.

### RF-07.2 — Asignación por defecto

1. Si la imagen figura en la lista de RF-07.4 → **página completa**.
2. Si el epígrafe la describe como dibujo, plano o legajo
   (`/dibujo|croquis|plano|legajo/i`), o su orientación es vertical →
   **dos tercios centrado**.
3. En cualquier otro caso → **ancho de caja**.

Sobre el corpus actual eso da: 6 a página completa, ~45 a dos tercios y ~54 a
ancho de caja, con el ancho de caja como formato dominante, tal como pide la
devolución.

Los topes por calidad de escaneo vigentes (`q-reduced`, `q-low`,
`src/styles/print.css:130-137`) se conservan y se aplican **dentro** del
contenedor elegido: una imagen de baja resolución nunca se promueve.

### RF-07.3 — La asignación es curable

La regla de RF-07.2 es el punto de partida. `scripts/manifest.mjs` acepta un mapa
`imageFormat` de `clave → contenedor` que la sobreescribe imagen por imagen, y
`npm run revision` deja en `build/revision-formatos.md` el inventario completo —
clave, epígrafe, orientación, calidad y contenedor asignado— para que el equipo
editorial pueda revisarlo y corregirlo sin tocar código.

### RF-07.4 — La página completa está reservada

Decisión D4 del equipo editorial. Van a página completa por curaduría:

- las **fotografías de carátula de sección** (5), que la spec 03 (RF-03.2) ubica
  en el verso siguiente a cada carátula. No se enumeran por clave: la carátula
  toma la fotografía que el mapa ancla al texto de apertura de esa parte, de
  modo que fijar una clave a mano quedaría obsoleta en cuanto se recalcule la
  secuencia;
- los **planos y relevamientos del EAAF y de la casona** (6): claves `002`,
  `083`, `084`, `085`, `092`, `093`, enumeradas en `FULL_PAGE_IMAGES`.

A esas once se suman las que la paginación promueve para que la crónica
siguiente abra en impar (spec 05, RF-05.3): en lugar de dejar un verso en
blanco, la última fotografía de la crónica toma esa página. Es la misma posición
editorial —después del último párrafo, antes de la crónica siguiente— y el
informe de `npm run pdf` dice cuántas fueron.

Cualquier otra promoción se hace por `imageFormat` (RF-07.3), con decisión
editorial explícita.

### RF-07.5 — El epígrafe va abajo a la derecha, en cuerpo menor

En el formato ancho de caja, el epígrafe se alinea **a la derecha**, debajo de la
imagen, en cuerpo menor que el del texto (7,4 pt en A5, ya vigente en
`src/styles/print.css:139-150`). El crédito sigue en línea propia. En los otros
dos contenedores el epígrafe se alinea al ancho de la figura.

### RF-07.6 — Un dibujo sin fondo no comparte página con una fotografía

Una figura marcada como dibujo (RF-07.2, punto 2) no puede quedar inmediatamente
encima ni inmediatamente debajo de una fotografía en la misma página: el dibujo
sin fondo contra el rectángulo pleno de la foto es lo que la devolución señala
como «ruido». Cuando la colocación lo produciría, el dibujo pasa a la página
siguiente.

### RF-07.7 — El sitio y el EPUB usan los mismos tres contenedores

Traducidos a medio continuo: ancho de caja = 100 % del ancho de la columna de
lectura; dos tercios = 66 % centrado; página completa = a sangre del ancho
disponible. La regla de RF-07.6 no aplica en medio continuo, donde no hay página.

## 3. Criterios de aceptación

- **CA-07.1** — Toda `<figure class="figure">` del PDF lleva exactamente una de
  las clases `box-full`, `box-two-thirds` o `box-page`.
- **CA-07.2** — Once figuras llevan `box-page` por curaduría: las 5 de carátula
  de sección y las 6 que enumera `FULL_PAGE_IMAGES`. El resto de las `box-page`
  del PDF son promociones de paridad, y `npm run pdf` informa cuántas.
- **CA-07.3** — `box-full` es el contenedor más frecuente del libro.
- **CA-07.4** — `build/revision-formatos.md` existe y lista las 105 imágenes con
  su contenedor asignado.
- **CA-07.5** — Ninguna página del PDF contiene un dibujo y una fotografía
  adyacentes.
- **CA-07.6** — En el PDF, ninguna figura excede el ancho de la caja de texto ni
  queda con texto a su costado.
- **CA-07.7** — Los epígrafes de las figuras `box-full` están alineados a la
  derecha.

## 4. Archivos afectados

- `src/lib/rehype-anchor-images.mjs:225-245` — asignación de contenedor.
- `scripts/manifest.mjs` — `imageFormat`.
- `src/styles/print.css:88-155` — los tres contenedores.
- `src/styles/book.css`, CSS del EPUB — equivalentes en medio continuo.
- `scripts/report-review.mjs` — `build/revision-formatos.md`.
- `scripts/build-pdf.mjs` — regla de adyacencia dibujo/fotografía.
