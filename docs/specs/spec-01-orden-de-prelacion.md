# Spec 01 — Orden de prelación de las primeras páginas

**Ediciones afectadas:** sitio, PDF, EPUB
**Origen:** especificaciones02.md, secciones «3 Desorden y orden de prelación» y «Orden de prelación de las primeras páginas»

## 1. Problema observado

El material preliminar arranca con un texto de contratapa, las citas quedan
sepultadas y el índice se parte en dos páginas por dos renglones.

Estado verificado del código:

- `scripts/build-pdf.mjs:75-90` arma el frente en este orden: `page-cover` →
  `page-blurb` («Sobre este libro») → `page-toc` (índice) → documentos.
- El texto de «Sobre este libro» es el cuerpo de `src/content/book/00-tapa.md`,
  cuyo `sourceFile` es `00.tapa y contratapa.md`: es, literalmente, prosa de
  contratapa.
- Las citas de Basualdo y Ponti son `src/content/book/01-primera-pagina.md`
  (`order: 1`, `pageType: interlude`) y caen **después** del índice.
- `scripts/build-epub.mjs:191-218` repite la misma secuencia en el lomo del EPUB.
- En el sitio, `src/components/Landing.astro:48-50` renderiza esa prosa en la
  sección `.blurb`, inmediatamente debajo de la tapa.
- No existe en ningún lado texto de créditos, legales, impresión ni copyleft
  (verificado por búsqueda en `src/content/`, `source/` y `docs/`).
- El índice del PDF lista 7 encabezados de parte + 23 documentos a 8,8 pt
  (`src/styles/print.css:172-183`) sin ninguna restricción de altura.

## 2. Orden requerido

Los números indican prelación, no numeración de página.

| # | Pieza | Página | Reverso |
|---|-------|--------|---------|
| 1 | **Portadilla** — título y logo de la CPM abajo | impar | blanco de cortesía |
| 2 | **Citas** — Basualdo y Ponti, en negrita, cuerpo mayor | impar | ver 3 |
| 3 | **Créditos y legales** — datos de impresión, copyleft, ISBN | par (reverso de 2) | — |
| 4 | **Índice** — una sola página | impar | blanco de cortesía |
| 5 | **Editorial de organismos** — «La memoria y la palabra: los juicios al genocidio» | impar | — |

El texto de contratapa deja de ser material preliminar y pasa al cierre del libro.

> **Nota de interpretación — resuelta.** La devolución dice «las citas van más
> adelante». Leída dentro de su párrafo, la frase describe el estado actual —hoy
> las citas quedan cuartas, detrás del índice— y no pide correrlas hacia atrás:
> el párrafo enumera tres problemas del frente y cierra con «más abajo te paso
> la propuesta de orden de prelación», que es la que los resuelve. La lista
> explícita es la que rige y ubica las citas en segundo lugar, antes del índice.
> Confirmado por el equipo editorial: se sigue la devolución.

## 3. Requisitos

### RF-01.1 — Portadilla propia

La primera página del PDF y del EPUB es una portadilla: título del libro,
subtítulo y logo de la CPM al pie. No lleva epígrafe, ni prosa, ni sumario.
El logo (`public/img/logo.webp`) debe incorporarse a las ediciones impresa y
digital, que hoy no lo usan.

### RF-01.2 — Las citas ocupan la segunda posición

`01-primera-pagina.md` pasa a `order: 1` efectivo en las tres ediciones y se
renderiza como página de citas: bloque en negrita, cuerpo tipográfico mayor que
el del cuerpo de texto general (referencia: 11–12 pt en A5, frente a los 9,6 pt
del cuerpo), atribución en cuerpo menor.

Su `title` («Primera página») no se imprime: ver RF-02.3.

### RF-01.3 — El texto de contratapa sale del frente

`00-tapa.md` deja de renderizarse como material preliminar.

- **PDF:** la sección `page-blurb` desaparece del frente y el texto se imprime
  en la última página del libro, después del anexo.
- **EPUB:** el documento `001-sobre-este-libro.xhtml` pasa al final del lomo,
  con `epub:type="backmatter"`.
- **Sitio:** la sección `.blurb` deja de seguir a la tapa y se integra al cierre,
  junto al colofón de `BookFooter.astro`.

### RF-01.4 — Página de créditos y legales

Se incorpora un documento nuevo de créditos: autoría, edición, institución,
datos de impresión, ISBN si corresponde, y la licencia copyleft.

- Vive en `src/content/book/` como documento propio con un `pageType` nuevo
  (`colophon` o equivalente) para que las tres ediciones lo reconozcan.
- En el PDF ocupa el reverso par de la página de citas.
- En el EPUB es un documento con `epub:type="copyright-page"`.
- En el sitio se muestra en el cierre, junto al colofón.

> **Pendiente P1:** el texto no existe. Lo aporta el equipo editorial.

### RF-01.5 — El índice entra en una sola página

El índice impreso no puede partirse. Debe caber íntegro en una página A5 con los
márgenes actuales (`@page` en `src/styles/print.css:13-17`: caja de 119 × 180 mm).

Estrategia admitida, en este orden de preferencia:

1. Ajustar interlineado y cuerpo del listado (hoy 8,8 pt / margen inferior 1,4 mm).
2. Comprimir el encabezado de parte a una línea con el título de la parte solamente.
3. Si aun así no entra, listar únicamente las partes y los documentos de apertura.

No se admite reducir el cuerpo por debajo de 7,5 pt.

### RF-01.6 — El índice del EPUB es el documento de navegación

En el EPUB no se imprime un índice paginado: la función la cumple `nav.xhtml`,
que ya existe. Sí debe reflejar el nuevo orden del lomo.

### RF-01.7 — El sitio respeta la misma prelación

El scroll continuo del sitio arranca: tapa → citas → editorial de organismos.
Créditos y contratapa quedan al final, antes o dentro del colofón.

## 4. Criterios de aceptación

- **CA-01.1** — En el PDF, la página 1 es la portadilla y su reverso está en blanco.
- **CA-01.2** — En el PDF, las citas de Basualdo y Ponti están en página impar y
  los créditos en su reverso par.
- **CA-01.3** — En el PDF, el índice ocupa exactamente una página y su reverso
  está en blanco o lleva una imagen a página completa (ver RF-03.4).
- **CA-01.4** — En el PDF, el primer texto corrido del libro es «La memoria y la
  palabra: los juicios al genocidio», en página impar.
- **CA-01.5** — La frase «El terror genocida desplegado en la Argentina entre 1976
  y 1983…» no aparece antes de la última página en ninguna de las tres ediciones.
- **CA-01.6** — En el EPUB, el orden del lomo es: portadilla, citas, créditos,
  editorial de organismos, …, contratapa.
- **CA-01.7** — En el sitio, al cargar la página, lo que sigue a la tapa al
  desplazarse son las citas, no el texto de contratapa.

## 5. Impacto técnico

| Archivo | Cambio |
|---------|--------|
| `scripts/manifest.mjs` | Nuevo `pageType` para créditos; revisión de `order` del frente |
| `src/content.config.ts` | Ampliar el `enum` de `pageType` |
| `src/content/book/` | Nuevo documento de créditos |
| `scripts/build-pdf.mjs:75-136` | Reordenar el frente, mover la contratapa al final, portadilla con logo |
| `scripts/build-epub.mjs:190-245` | Reordenar el lomo, `epub:type` correctos |
| `src/pages/index.astro` | Reubicar la contratapa; nuevo componente de créditos |
| `src/components/Landing.astro` | Quitar la sección `.blurb` del bloque de tapa |
| `src/styles/print.css:127-183` | Portadilla, página de citas, créditos, índice de una página |

## 6. Fuera de alcance

- Redacción del texto de créditos (insumo editorial).
- Numeración de folios: el criterio actual (`FIRST_NUMBERED` en
  `scripts/build-pdf.mjs:231`) se recalcula como consecuencia del nuevo frente,
  pero no se redefine acá.
