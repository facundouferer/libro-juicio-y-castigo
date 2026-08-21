# Spec 03 — Flujo de texto y paginación del PDF

**Ediciones afectadas:** PDF A5 (la edición impresa es la única con página física)
**Origen:** especificaciones02.md, sección «2) Flujo Tipográfico y Diagramación»
**Depende de:** [spec 04](spec-04-secuencia-de-imagenes.md)

## 1. Problema observado

Las imágenes irrumpen en medio de los bloques de texto y rompen la lectura
continuada.

La causa es de diseño, no un defecto: `src/lib/rehype-anchor-images.mjs:116-156`
reparte deliberadamente las figuras de un título **entre los párrafos** que le
siguen, para que la placa lateral del sitio vaya avanzando mientras se lee. Esa
decisión es correcta en pantalla y equivocada en papel: en el PDF, el mismo
reparto mete una fotografía entre dos párrafos de una misma crónica.

El plugin ya recibe el `target` (`web` | `print` | `epub`,
`src/lib/rehype-anchor-images.mjs:60`) y hoy lo usa sólo para decidir el marcado
de la imagen, no su ubicación.

Además, la paginación actual no controla paridad: `.doc`, `.chapter` y
`.doc.interlude` fuerzan salto de página (`src/styles/print.css:232-238`) pero
nada garantiza que el salto caiga en impar.

## 2. Requisitos

### RF-03.1 — Las imágenes no cortan bloques de texto

En la edición impresa, ninguna figura se inserta entre párrafos de un mismo
bloque de texto. Las figuras se ubican únicamente en los límites de un texto:

1. Al comienzo del texto, antes del primer párrafo.
2. Al final del texto, después del último párrafo y antes del que sigue.
3. En un punto intermedio **sólo** si coincide con un cambio de título (`h2`–`h4`).

El reparto entre párrafos se conserva sin cambios para el `target: 'web'`.

### RF-03.2 — Dos formatos de figura, no más

Cada figura impresa adopta uno de dos formatos:

| Formato | Ocupación | Uso |
|---------|-----------|-----|
| **Página completa** | Toda la caja de 119 × 180 mm | Imágenes grandes, aperturas, blancos de cortesía |
| **Media página** | Hasta la mitad de la caja, al pie o a la cabeza de la página | Resto |

La referencia de proporción es la página 18 de la maqueta revisada.

Los topes por calidad de escaneo que ya existen se mantienen y se aplican
**dentro** del formato elegido: una imagen `q-low` no puede promoverse a página
completa (`src/styles/print.css:108-111`).

### RF-03.3 — Todo comienzo va en página impar

Empiezan en recto, sin excepción:

- cada sección (apertura de parte),
- cada capítulo,
- cada crónica,
- cada texto que el manifiesto declare como documento propio.

Implementación esperada: `break-before: recto` sobre `.doc` y `.chapter`, con
verificación posterior sobre el PDF producido, porque el motor de paginación
puede no honrar `recto` en todos los casos.

### RF-03.4 — Los blancos de cortesía se aprovechan

Cuando un texto termina en impar y su reverso par queda vacío, esa página par se
utiliza para una imagen a página completa, tomada de la secuencia de la sección
en curso.

Reglas:

- La imagen usada en un blanco de cortesía **no se repite** en su ubicación
  original: se consume de la secuencia (ver [spec 04](spec-04-secuencia-de-imagenes.md)).
- Si no hay imagen disponible en la sección, la página queda efectivamente en
  blanco, sin folio y sin ningún elemento decorativo.
- El epígrafe acompaña a la imagen también en esta posición.

### RF-03.5 — Ninguna imagen se parte entre páginas

Se mantiene la regla vigente (`break-inside: avoid` en
`src/styles/print.css:94-96`) y se extiende a la unidad figura + epígrafe: el
epígrafe nunca queda solo en la página siguiente.

### RF-03.6 — Verificación de paginación

El proyecto incorpora una comprobación automática sobre el PDF producido que
informa, y hace fallar la generación si detecta:

- documentos que arrancan en página par,
- figuras cuya caja cruza un límite de página,
- epígrafes separados de su figura,
- páginas en blanco no previstas.

Se integra como paso de `npm run pdf` o como script propio invocado por
`npm run check`.

### RF-03.7 — Estructura de la apertura de parte

> «Ahí empieza una sección. Iba vacía la página, es como portada de sección, y
> del otro lado, en impar, el texto "En el lugar sin límites" completo, sin estar
> partido por una imagen. Y otra vez reverso (página par) vacío y en impar
> comienza la primera crónica.»

Cada una de las cinco partes se abre con esta secuencia física:

| Página | Contenido |
|--------|-----------|
| impar | **Portada de parte**: número de parte, volanta con el título de la sección, título del texto de apertura. Sin cuerpo de texto. Admite la fotografía de apertura a página completa |
| par | Blanco de cortesía, o imagen a página completa (RF-03.4) |
| impar | **Texto de apertura completo**, sin ninguna imagen intercalada |
| par | Blanco de cortesía, o imagen a página completa |
| impar | Comienzo de la primera crónica |

El texto de apertura de parte —los cinco documentos de `pageType:
chapter-opening`— es la única categoría en la que **ninguna** imagen puede
intercalarse, ni siquiera en un límite de bloque: el texto se lee entero y sin
interrupción.

Esto reemplaza el armado actual, que ubica la fotografía en la primera página y
el bloque de título más el texto en la segunda, dejando el texto en página par
(`scripts/build-pdf.mjs:117-129`, `src/styles/print.css:194-215`).

## 3. Criterios de aceptación

- **CA-03.1** — En el PDF final, ninguna figura queda entre dos párrafos
  consecutivos de un mismo texto.
- **CA-03.2** — Toda figura impresa ocupa página completa o como máximo la mitad
  de la caja de texto.
- **CA-03.3** — Los 24 documentos del libro comienzan en página impar.
- **CA-03.4** — Toda página par vacía anterior a un comienzo lleva una imagen a
  página completa, o está declarada como blanco intencional en el reporte de
  verificación.
- **CA-03.5** — Ninguna figura ni epígrafe se parte entre páginas.
- **CA-03.6** — El paso de verificación corre en CI y falla ante cualquiera de
  las condiciones de RF-03.6.
- **CA-03.7** — Las cinco aperturas de parte siguen la secuencia física de
  RF-03.7, y sus textos de apertura no llevan ninguna imagen intercalada.

## 4. Impacto técnico

| Archivo | Cambio |
|---------|--------|
| `src/lib/rehype-anchor-images.mjs:116-156` | Colocación distinta según `target`: bordes de bloque en `print` |
| `src/styles/print.css` | `break-before: recto`; clases de formato completo / media página |
| `scripts/build-pdf.mjs` | Blancos de cortesía; consumo de imágenes de relleno |
| `scripts/check-build.mjs` *(o script nuevo)* | Verificación de paginación sobre el PDF |
| `.github/workflows/deploy.yml` | Incorporar la verificación al pipeline |

## 5. Riesgos

- **Crecimiento del libro.** Forzar recto y promover imágenes a página completa
  aumenta el número de páginas. Debe medirse antes y después y reportarse, porque
  impacta en el costo de impresión.
- **Paginación por Chrome.** La paginación la hace el motor del navegador
  (`scripts/build-pdf.mjs:170-203`). El soporte de `break-before: recto` debe
  verificarse empíricamente; si no lo honra, la alternativa es insertar páginas
  en blanco explícitas durante el armado del HTML.
- **Mapeo del índice interno.** `pageOf()` en `scripts/build-pdf.mjs:252-253`
  estima la página por regla de tres sobre el alto del documento. Con páginas en
  blanco intercaladas esa estimación se degrada y probablemente haya que
  reemplazarla por una medición real por marcador.
