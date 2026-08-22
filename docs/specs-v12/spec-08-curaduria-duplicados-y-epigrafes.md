# Spec 08 — Curaduría: duplicados y errores de epígrafe

**Ediciones afectadas:** Sitio, PDF, EPUB
**Origen:** `especificaciones03.md`, secciones «Errores en los epígrafes» y «Desorden de imágenes»
**Depende de:** —

## 1. Problema observado

> «**EPÍGRAFE DE MARÍA JULIA MORRESI,** dice detenida policía, es política.
> Pág. 32»

> «**Desorden de imágenes.** Mejoró. De todos modos se repiten las de Chachi,
> aparecen DOS veces.»

**El epígrafe.** `source/content-original/epigrafes-images-contenido.md:17` dice
«Ex detenida **policía** María Julia Morresi, dibujo de Alejandro Gallardo». Es
una errata: María Julia Morresi fue detenida **política**. El error se propaga a
`src/data/captions.json` y de ahí a las tres ediciones.

**Los duplicados.** Comprobado por suma de verificación: el archivo tiene dos
pares de fotografías **idénticas byte a byte**, catalogadas con dos claves
distintas porque el epígrafe las numeró dos veces.

| Clave | Archivo | SHA-1 | Colocada en |
|-------|---------|-------|-------------|
| `018bis` | `IMG_018_BIS CHACHI V (1).JPG` | `c97ee734…` | Crónicas 1 — «In justicia militar…» |
| `061` | `IMG_061_ CHACHI V.JPG` | `c97ee734…` | Crónicas 2 — «La violencia sexual como delito autónomo…» |
| `018bisbis` | `IMG_018_BIS BIS CHACHI FULBO.jpg` | `cef904e4…` | Crónicas 1 — «El sobreviviente de la casa de Tarzán» |
| `062` | `IMG_062_CHACHI FUTBOLT.jpg` | `cef904e4…` | Crónicas 2 — «Ni una menos» |

Son los únicos dos duplicados exactos de las 105 imágenes. El mecanismo para
descartarlos ya existe —`scripts/image-skip.json`, de la ronda anterior— pero
está vacío porque nadie detectó el caso: el informe de duplicados que lo
alimentaba comparaba epígrafes, no archivos.

## 2. Requisitos

### RF-08.1 — Corrección del epígrafe de Morresi

En `source/content-original/epigrafes-images-contenido.md:17`, «Ex detenida
policía» pasa a «Ex detenida política».

Se corrige en el **origen**, no en el JSON derivado: `npm run captions` regenera
`src/data/captions.json` desde ese archivo y sobreescribiría cualquier parche
aplicado aguas abajo.

### RF-08.2 — Barrido de erratas del mismo tipo

Se revisan los 105 epígrafes buscando el mismo error de sustitución
(«policía» donde corresponde «política» y viceversa) y cualquier otra
calificación de una víctima como policía. Todo hallazgo se informa; se corrige
sólo lo que sea inequívoco.

### RF-08.3 — Detección automática de duplicados exactos

`npm run map` calcula la suma SHA-1 de cada archivo de `src/images/content/` y
deja en `build/revision-duplicados.md` los grupos de archivos idénticos, con la
clave y el epígrafe de cada uno. Es información que el equipo editorial necesita
para decidir, y hoy no existe: el informe que la spec 04 de la ronda anterior
prometía nunca llegó a generarse.

### RF-08.4 — Se descartan las repeticiones de Chachi

Se agregan a `scripts/image-skip.json` las claves **`061`** y **`062`**.

Criterio de cuál de cada par se conserva: se conserva la que está en el
**interludio de Chachi y su sección**, `018bis` y `018bisbis` en «Una casa con una
Sala Negra», que es donde el personaje tiene su semblanza. Las repeticiones en
«La violencia sexual como crimen de lesa humanidad» son las que se retiran.

Los archivos de imagen **no se borran**: `image-skip.json` sólo los excluye de la
colocación, de modo que la decisión es reversible sin recuperar nada.

### RF-08.5 — Recolocación tras el descarte

Al liberarse los dos anclajes de «Crónicas 2», `npm run map` reasigna la
secuencia. El resultado debe mantener las propiedades que garantiza la spec 04 de
la ronda anterior: recorrido monótono, sin retrocesos y sin repeticiones.

### RF-08.6 — La verificación falla si vuelve a haber duplicados

`npm run check` falla cuando dos claves colocadas apuntan a archivos con la misma
suma de verificación. Es lo que impide que el defecto vuelva sin que nadie lo
note.

## 3. Criterios de aceptación

- **CA-08.1** — `source/content-original/epigrafes-images-contenido.md` no
  contiene la cadena «detenida policía»; tras `npm run captions`,
  `src/data/captions.json` tampoco.
- **CA-08.2** — El epígrafe de la clave `008` dice «Ex detenida política María
  Julia Morresi, dibujo de Alejandro Gallardo» en las tres ediciones.
- **CA-08.3** — `build/revision-duplicados.md` existe y lista exactamente los dos
  grupos de duplicados exactos.
- **CA-08.4** — `scripts/image-skip.json` contiene `["061", "062"]`.
- **CA-08.5** — En el PDF y en el sitio, cada una de las dos fotografías de Chachi
  aparece **una sola vez** en todo el libro.
- **CA-08.6** — `src/data/image-map.json` no asigna `061` ni `062` a ningún
  anclaje.
- **CA-08.7** — `npm run check` pasa y verifica la ausencia de duplicados por
  suma de verificación.

## 4. Archivos afectados

- `source/content-original/epigrafes-images-contenido.md:17` — la errata.
- `scripts/image-skip.json` — `061` y `062`.
- `scripts/build-image-map.mjs` — informe de duplicados por SHA-1.
- `scripts/check-build.mjs` — verificación de unicidad.
- `src/data/captions.json`, `src/data/image-map.json` — regenerados.
