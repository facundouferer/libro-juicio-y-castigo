# Spec 09 — Publicación del PDF y el EPUB corregidos

**Ediciones afectadas:** Repositorio y sitio publicado
**Origen:** `especificaciones03.md`, encabezado
**Depende de:** specs 01–08

## 1. Problema observado

> «Las correcciones que aquí se detallan deben hacerse tanto al sitio como a los
> archivos PDF y EPUB y todo, incluso los archivos PDF y EPUB deben agregarse a
> los commites para las PR.»

En la ronda anterior los binarios sí entraron en el commit, pero el manifiesto de
descargas —`src/data/downloads.json`, que alimenta el modal de descarga con
tamaño, número de páginas y fecha— quedó desactualizado, y hubo que corregirlo
después (commit `67a6657`). El paso `npm run downloads` no está encadenado a la
generación.

## 2. Requisitos

### RF-09.1 — Los binarios regenerados entran en el commit

`public/descargas/juicio-y-castigo-en-el-chaco-vol-2.pdf` y su `.epub` se
regeneran con todas las correcciones de esta ronda y se versionan en el mismo
commit que el código que los produce. No se publica una PR con código corregido y
descargas viejas.

### RF-09.2 — El manifiesto se regenera siempre con los binarios

`npm run prepare:downloads` ya encadena `pdf`, `epub` y `downloads`. El requisito
es de procedimiento: **ningún commit** puede modificar el PDF o el EPUB sin
modificar también `src/data/downloads.json`. Se agrega esa verificación a
`npm run check`: si los tamaños declarados en el manifiesto no coinciden con los
archivos en disco, falla.

### RF-09.3 — La versión se declara

Esta entrega es la **1.2**. El número aparece en:

- `package.json` (`version: "1.2.0"`),
- `src/data/downloads.json`, junto a la fecha de generación,
- los metadatos del PDF y del EPUB,
- el modal de descarga del sitio, para que quien descargue sepa qué versión tiene.

### RF-09.4 — La verificación de assets sigue pasando

`npm run check` verifica las ~550 referencias a imágenes del sitio compilado con
el `SITE_BASE` real del despliegue. Ese control se mantiene y debe pasar antes de
publicar.

### RF-09.5 — Registro de lo entregado

El cuerpo de la PR enumera qué requisitos de esta ronda quedaron cumplidos y
cuáles no, con su identificador. Un requisito que no se pudo cumplir se declara;
no se omite.

## 3. Criterios de aceptación

- **CA-09.1** — El commit contiene `public/descargas/*.pdf`, `public/descargas/*.epub`
  y `src/data/downloads.json` modificados juntos.
- **CA-09.2** — `npm run check` pasa, incluida la verificación de coherencia entre
  el manifiesto y los binarios.
- **CA-09.3** — `src/data/downloads.json` declara versión `1.2` y la fecha de
  generación, y sus tamaños coinciden byte a byte con los archivos.
- **CA-09.4** — El PDF declara en sus metadatos el título, el editor y la versión.
- **CA-09.5** — El sitio compilado (`npm run build`) no reporta referencias a
  assets faltantes.
- **CA-09.6** — El cuerpo de la PR enumera los requisitos RF-01.1 a RF-09.5 con su
  estado.

## 4. Archivos afectados

- `package.json` — versión.
- `scripts/build-downloads.mjs` — versión y fecha en el manifiesto.
- `scripts/check-build.mjs` — coherencia manifiesto ↔ binarios.
- `scripts/build-pdf.mjs`, `scripts/build-epub.mjs` — metadatos de versión.
- `src/components/DownloadModal.astro` — mostrar la versión.
