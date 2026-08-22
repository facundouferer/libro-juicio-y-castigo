# Spec 06 — Colocación de las imágenes en el flujo

**Ediciones afectadas:** PDF (principal), Sitio y EPUB (coherencia)
**Origen:** `especificaciones03.md`, secciones «Flujo y tipográfico y diagramación» e «Imágenes»
**Depende de:** [spec 04](spec-04-volanta-y-titular-de-cronica.md), [spec 05](spec-05-apertura-de-cronicas-en-impar.md)

## 1. Problema observado

> «**Corte de texto por imágenes, persiste el error.** Las imágenes siguen
> interrumpiendo bloques de texto en curso.»

> «Tomemos como regla de que la imagen aparece **después del último párrafo de
> una crónica o subsección**, antes de que comience la siguiente. […] Que la
> imagen vaya **al pie de página**, cuando el texto de esa crónica terminó y
> queda espacio disponible en la parte inferior, no antes. Nunca una imagen entre
> el título de una crónica y su primer párrafo. […] el texto siempre manda: la
> imagen espera a que el texto termine y ocupa el espacio que queda, o tiene su
> propia página.»

La ronda anterior movió las figuras impresas al final del tramo de **cada
encabezado** (`src/lib/rehype-anchor-images.mjs:147-150`). El resultado sigue sin
satisfacer la devolución por dos razones:

1. **La unidad es demasiado chica.** Un tramo de `h2` es una subsección dentro de
   una crónica en curso. Aunque la imagen caiga en un borde de encabezado, para
   quien lee la crónica sigue abierta y la fotografía la interrumpe.
2. **La imagen se acomoda donde caiga.** No hay ninguna regla que la empuje al
   pie de la página; Chrome la coloca donde el flujo la deja, y el texto siguiente
   la rodea por abajo. La devolución pide lo contrario: el texto manda, la imagen
   espera.

## 2. Requisitos

### RF-06.1 — La crónica es la unidad de anclaje en papel

En `print` y `epub`, las imágenes de una crónica se acumulan y se emiten **al
final de la crónica**, después de su último párrafo y antes de la volanta
siguiente. Se deja de emitirlas al final de cada tramo de `h2`.

Excepción: un documento largo sin crónicas (por ejemplo «Los fallos» o
«Genocidas al frente») conserva el tramo de encabezado como unidad, que es su
única división disponible.

El reparto entre párrafos se conserva **sin cambios** para `target: 'web'`: en
pantalla, la placa que avanza mientras se lee es el mecanismo central del sitio.

### RF-06.2 — La imagen ocupa el pie de la página, nunca desplaza texto

Las figuras que cierran una crónica se agrupan en un contenedor
`<div class="tail-figures">` que se ancla al pie de la caja de texto. Cuando la
crónica termina a media página, la imagen baja al fondo y el hueco queda entre el
último párrafo y la imagen, no debajo de ella.

Cuando la cola de la crónica no deja espacio suficiente para la figura en su
formato asignado (spec 07), la figura pasa a la página siguiente.

### RF-06.3 — Nunca una imagen entre el título de una crónica y su primer párrafo

Prohibición explícita. Ninguna figura puede emitirse entre un
`header.cronica-head` y el primer bloque de cuerpo que le sigue. Se aplica
también a la fotografía de documento (`plate`) de interludios y aperturas, que
hoy `scripts/build-pdf.mjs:213-216` emite justo después del `doc-head`.

### RF-06.4 — Las imágenes que no entran alimentan las páginas completas

Las figuras de una crónica que no caben en su cola pasan, por orden, a:

1. la página de imagen que la spec 05 inserta antes de la crónica siguiente
   (RF-05.3);
2. si no hay tal página o ya está ocupada, una página propia inmediatamente
   posterior a la cola.

Es la misma posición editorial en los dos casos —después del último párrafo de
una crónica, antes de que empiece la siguiente— así que ninguna imagen se
descoloca por reubicarse.

### RF-06.5 — Ninguna imagen se pierde ni se duplica

El total de imágenes colocadas en el PDF debe ser exactamente el mismo que el
mapa asigna, sin repeticiones. Es la garantía de que la reubicación de RF-06.4 no
introduce copias ni deja huérfanas.

### RF-06.6 — Orden de lectura preservado

Una imagen nunca se adelanta a la crónica a la que pertenece: sólo puede
desplazarse hacia adelante, y como mucho hasta antes del comienzo de la crónica
siguiente.

## 3. Criterios de aceptación

- **CA-06.1** — En `build/pdf/libro.html` no hay ninguna `<figure class="figure">`
  entre dos `<p>` de un mismo tramo de crónica.
- **CA-06.2** — No hay ninguna `<figure>` entre un `header.cronica-head` o
  `.doc-head` y el primer `<p>` que le sigue.
- **CA-06.3** — El recuento de `<figure class="figure">` del PDF es igual al
  número de imágenes asignadas en `src/data/image-map.json` una vez descontadas
  las descartadas por `scripts/image-skip.json`, y no hay claves repetidas.
- **CA-06.4** — Toda figura del PDF aparece después del último párrafo de su
  crónica y antes de la volanta de la crónica siguiente. Verificable por posición
  de nodos.
- **CA-06.5** — En las páginas donde una crónica termina a media caja, la figura
  está alineada al pie y el espacio en blanco queda por encima.
- **CA-06.6** — El sitio conserva el reparto entre párrafos: el recuento de
  posiciones de figura en `dist/index.html` no cambia respecto de la versión
  anterior.

## 4. Archivos afectados

- `src/lib/rehype-anchor-images.mjs:116-160` — unidad de anclaje por crónica en
  `print` / `epub`.
- `scripts/build-pdf.mjs` — agrupación en `tail-figures`, desborde a página
  completa, relleno del verso insertado.
- `src/styles/print.css:88-140` — anclaje al pie y contenedores.
- `scripts/check-build.mjs` — verificación de recuento y de unicidad.
