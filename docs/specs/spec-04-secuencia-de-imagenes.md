# Spec 04 — Secuencia y unicidad de las imágenes

**Ediciones afectadas:** sitio, PDF, EPUB
**Origen:** especificaciones02.md, «de imágenes: la secuencia de fotografías e ilustraciones rompe el orden narrativo planificado»

## 1. Problema observado

> «En la carpeta están en orden. En el libro están desordenadas, y hay un par que
> se repiten, la Chachi, y creo un dibujo de la Casa tb.»

Ambas cosas están confirmadas.

**Desorden.** Recorriendo el libro en orden de lectura y anotando la clave de cada
imagen, la secuencia resultante es:

```
031 081 040 014 006 094 003 019 015 044 035 056 052 004 086 022 039 065 009 008 …
```

Sobre 105 imágenes hay **51 saltos hacia atrás**: casi la mitad de las
transiciones rompen la numeración de la carpeta, que es el orden narrativo que el
equipo editorial definió en `src/content/epigrafes-images-contenido.md`.

La causa está en `scripts/build-image-map.mjs`: el asignador ubica cada imagen por
afinidad semántica entre su epígrafe y el título más parecido, y cuando no hay
lugar la desplaza al título vecino, al documento vecino o a la galería de cierre
(cabecera del archivo, líneas 5-21). En ningún momento considera el orden de la
carpeta.

**Repeticiones.** No hay claves duplicadas —las 105 imágenes se colocan una sola
vez cada una— pero sí hay imágenes distintas con el mismo contenido:

| Claves | Epígrafe | Observación |
|--------|----------|-------------|
| `084`, `085` | «Plano de la vieja casona de Marcelo T. de Alvear 32 /Gentileza» | Epígrafe **idéntico**. El propio mapa las marca: «Segundo plano idéntico de la casona» (`src/data/image-map.json`, entrada de revisión de `085`) |
| `018bis`, `061` | Retratos de Gregorio «Chachi» Quintana | Colocadas muy lejos entre sí: `061` en la primera parte, `018bis` bastante después |

## 2. Requisitos

### RF-04.1 — El orden de la carpeta es el orden del libro

La secuencia de aparición de las imágenes en las tres ediciones sigue la
numeración de origen: `001`, `002`, `003`, … `013`, `013bis`, `014`, … `018`,
`018bis`, `018bisbis`, … `105`.

Esa numeración es el guion visual del libro y tiene prioridad sobre la afinidad
semántica entre epígrafe y título.

### RF-04.2 — La asignación pasa a ser monótona

`scripts/build-image-map.mjs` se reescribe como asignador ordenado:

1. Recorre las imágenes en orden de carpeta.
2. Para cada una, busca destino a partir de la posición donde quedó la anterior,
   nunca antes.
3. La afinidad semántica se usa para elegir **entre los destinos disponibles a
   partir de esa posición**, no para elegir libremente en todo el libro.
4. Si no hay lugar hacia adelante en el documento actual, avanza al siguiente
   documento de la misma parte, y luego a la parte siguiente.

Se conservan sin cambios los límites de capacidad por título
(`BLOCKS_PER_IMAGE`, `MAX_PER_HEADING`) y el reporte `review`.

### RF-04.3 — Reporte de monotonía

El script informa al terminar cuántos saltos hacia atrás quedaron en la secuencia
final. El objetivo es **cero**. Cualquier salto remanente se enumera con su
motivo.

`scripts/check-build.mjs` incorpora la verificación: si hay saltos hacia atrás no
declarados, la generación falla.

### RF-04.4 — Depuración de imágenes casi idénticas

Se produce un reporte de imágenes candidatas a duplicado que agrupa:

- epígrafes idénticos o con similitud alta,
- retratos de la misma persona colocados en documentos distintos.

Sobre ese reporte, el equipo editorial decide cuáles se descartan. La decisión se
registra en el repositorio como lista explícita —por ejemplo un campo `skip` en
`scripts/proposed-anchors.json` o un archivo propio— con el motivo de cada
descarte. **No** se elimina el archivo de imagen: se excluye de la colocación.

Casos que entran al reporte por evidencia ya verificada:
`084`/`085` (plano de la casona) y `018bis`/`061` (retratos de Chachi).

> **Pendiente P3:** la selección final la hace el equipo editorial.

### RF-04.5 — Una imagen aparece una sola vez

Ninguna imagen puede aparecer dos veces en la misma edición, ni siquiera cuando
se la usa para llenar un blanco de cortesía (ver
[RF-03.4](spec-03-flujo-de-texto-y-paginacion.md)). El relleno de blancos consume
la imagen de la secuencia.

### RF-04.6 — Las tres ediciones comparten la secuencia

El orden resultante es el mismo en el sitio, el PDF y el EPUB, porque las tres
leen `src/data/image-map.json`. Ninguna edición reordena por su cuenta.

## 3. Criterios de aceptación

- **CA-04.1** — Recorriendo el libro en orden de lectura, la secuencia de claves
  de imagen es monótona creciente respecto de la numeración de la carpeta.
- **CA-04.2** — `npm run map` informa `saltos hacia atrás: 0`.
- **CA-04.3** — `npm run check` falla si aparece un salto hacia atrás no declarado.
- **CA-04.4** — Existe en el repositorio un reporte de duplicados y una lista de
  descartes con motivo.
- **CA-04.5** — Ninguna clave de imagen aparece dos veces en el PDF, el EPUB o el
  sitio.
- **CA-04.6** — La secuencia de imágenes del PDF y la del EPUB coinciden clave a
  clave con la del sitio.

## 4. Impacto técnico

| Archivo | Cambio |
|---------|--------|
| `scripts/build-image-map.mjs` | Reescritura del asignador: recorrido monótono |
| `scripts/proposed-anchors.json` | Lista de descartes con motivo |
| `scripts/check-build.mjs` | Verificación de monotonía y de unicidad |
| `src/data/image-map.json` | Regenerado |

## 5. Consecuencia esperada

Al subordinar la afinidad semántica al orden narrativo, algunas imágenes van a
caer junto a títulos con los que no tienen relación literal. Es el resultado
buscado: el orden de la carpeta es una decisión editorial y prevalece sobre la
coincidencia textual. El listado `review` del mapa deja de ser una alerta y pasa a
ser, simplemente, el inventario de la colocación.
