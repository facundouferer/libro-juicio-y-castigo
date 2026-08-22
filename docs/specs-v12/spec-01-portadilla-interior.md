# Spec 01 — Portadilla interior: sin imagen y con jerarquía propia

**Ediciones afectadas:** PDF A5 (principal), EPUB, Sitio (coherencia)
**Origen:** `especificaciones03.md`, sección «Cambio del tamaño del título»
**Depende de:** —

## 1. Problema observado

> «En la primera página "CAUSA BRIGADA I, II, III" quedó demasiada subordinada.
> Es necesario darle más de tamaño. La primera página no es la tapa sino la hoja
> de portada interna, por lo que es mejor que vaya sin imagen dentro, para
> resaltar el título y la demás información que posee.»

La portadilla del PDF se arma en `scripts/build-pdf.mjs:103-111` y se compone de
cuatro piezas: una fotografía (`img/tapa.jpg`), el título, el subtítulo
«Causa Brigada I, II, III» y la volanta «Crónicas, dibujos y fotografías», más el
logo al pie.

Dos defectos:

1. **La fotografía compite.** `src/styles/print.css:167-178` le da hasta 92 mm de
   los 180 mm de caja: más de la mitad de la página. La portadilla interior no es
   la tapa; la fotografía ya cumple su función en la tapa y acá sólo resta aire
   al bloque tipográfico.
2. **La jerarquía aplasta el subtítulo.** El título va a 26 pt
   (`src/styles/print.css:180-185`) y «Causa Brigada I, II, III» a 15 pt
   (`:187-193`). Un 58 % del título lo deja leyéndose como pie, no como
   coordinado. Es el dato que identifica de qué trata el volumen.

## 2. Requisitos

### RF-01.1 — La portadilla interior no lleva fotografía

Se elimina la figura `.page-title-photo` de la portadilla del PDF. La página
queda íntegramente tipográfica: título, subtítulo, volanta y el logo de la CPM
Chaco al pie.

La fotografía de tapa **no se toca**: sigue en la tapa del sitio, en la portada
del EPUB y en `public/img/`. Es sólo la portadilla interior la que la pierde.

### RF-01.2 — «Causa Brigada I, II, III» sube de rango

El subtítulo deja de ser un pie del título y pasa a ser el segundo nivel de un
bloque de dos. La relación de cuerpos entre título y subtítulo queda entre
**1,5:1 y 1,8:1**, y el subtítulo nunca baja de **19 pt** en A5.

Valores de referencia para A5 (119 mm de caja):

| Pieza | Antes | Ahora |
|-------|-------|-------|
| `Juicio y Castigo en el Chaco / Vol II` | 26 pt | **32 pt** |
| `Causa Brigada I, II, III` | 15 pt | **20 pt** |
| `Crónicas, dibujos y fotografías` | 10 pt | **11 pt** |

### RF-01.3 — La portadilla sigue entrando en una sola página

Al ganar cuerpo el bloque tipográfico y perder la fotografía, la página debe
seguir midiendo exactamente una página. El control que ya existe
(`scripts/build-pdf.mjs:466-486`, umbral `CONTENT_PX`) se mantiene y debe pasar.

### RF-01.4 — El orden de prelación no cambia

La secuencia fijada por la ronda anterior (spec 01 de `docs/specs/`) sigue
vigente sin modificación: portadilla (1) · blanco (2) · citas (3) · créditos (4)
· índice (5) · blanco (6) · primer texto (7). Esta spec sólo cambia el contenido
de la página 1.

### RF-01.5 — La misma decisión en el EPUB

La `cover-page` del EPUB (`scripts/build-epub.mjs:303-309`) adopta la misma
relación de cuerpos entre título y subtítulo. No lleva fotografía embebida en la
portadilla —la portada del EPUB es una imagen aparte, definida en el OPF— así que
en esa edición sólo cambia la escala tipográfica.

## 3. Criterios de aceptación

- **CA-01.1** — `build/pdf/libro.html` no contiene ninguna ocurrencia de
  `page-title-photo`, y la página 1 del PDF no tiene imagen.
- **CA-01.2** — En `src/styles/print.css`, `.page-title h1` mide 32 pt y
  `.page-title .sub` mide 20 pt; el cociente entre ambos está en `[1.5, 1.8]`.
- **CA-01.3** — `npm run pdf` imprime «Todas las piezas del frente entran en su
  página» y no reporta la portadilla como excedida.
- **CA-01.4** — El informe de prelación de `npm run pdf` sigue mostrando las
  siete entradas en el mismo orden y con la misma paridad.
- **CA-01.5** — En el EPUB, `.cover-page h1` y `.cover-page .sub` guardan la
  misma proporción `[1.5, 1.8]`.

## 4. Archivos afectados

- `scripts/build-pdf.mjs:103-111` — quitar la figura de la portadilla.
- `src/styles/print.css:158-200` — escala tipográfica y baja de `.page-title-photo`.
- `scripts/build-epub.mjs:119-128` — escala de la portadilla del EPUB.
