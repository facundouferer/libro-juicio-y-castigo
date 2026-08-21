# Spec 06 — Tapa: fotografía real en lugar de imagen generada

**Ediciones afectadas:** sitio, PDF, EPUB
**Origen:** especificaciones02.md, sección «C. Tapa y Aportes Visuales» y «Arte: Sustituir IA por fotografía real de época o del sitio histórico»

## 1. Problema observado

> «Al usar la IA creo que debilita la contundencia documental e histórica del libro.»

El fondo de tapa actual es un collage generado: `src/images/fondo-tapa.png`,
derivado a `public/img/fondo-tapa-{960,1600,2400}.{avif,webp}` por
`scripts/optimize-images.mjs:194-213`, y consumido por
`src/components/Landing.astro:15-34` y como `og:image` en
`src/layouts/Base.astro:19`.

Además, el PDF y el EPUB **no tienen tapa ilustrada**: sus portadillas son sólo
tipográficas (`scripts/build-pdf.mjs:75-90`, `scripts/build-epub.mjs:191-207`).

El archivo del libro ya contiene fotografías reales del edificio:

- `031` — «Fachada de la ex Brigada de Investigaciones, antes de su conformación
  como sitio histórico de memoria y sede de la Comisión Provincial por la Memoria
  Chaco, en 2004.» Es exactamente la imagen de fachada que la devolución pide.
- `src/edificio/frente de la fachada por marcelo t de alvear.jpg`
- `src/edificio/vista del frente.png`, `src/edificio/foto entrada.png`

## 2. Requisitos

### RF-06.1 — Ninguna imagen generada por IA en el libro

Se establece como regla del proyecto: el libro es un documento histórico y su
material visual es documental. No se usan imágenes generadas por IA en la tapa,
la contratapa, las aperturas de sección ni el interior, en ninguna de las tres
ediciones.

`src/images/fondo-tapa.png` se retira del pipeline. Se conserva en el repositorio
si se lo quiere como registro, pero deja de generar derivados y deja de
referenciarse.

### RF-06.2 — La tapa lleva una fotografía real de la Brigada

El fondo de tapa pasa a ser una fotografía real de la fachada o del sitio
histórico.

Candidata inmediata verificada: la imagen `031`. Su epígrafe y su crédito ya
están registrados en `src/data/captions.json`.

> **Pendiente P2:** el equipo editorial puede aportar una fotografía distinta,
> específica para tapa. Mientras no llegue, la implementación usa `031`.

Requisitos técnicos de la imagen elegida:

- Resolución suficiente para 2400 px de ancho en el sitio y para 148 × 210 mm a
  300 ppp en el PDF.
- Si es apaisada y la tapa la necesita vertical, se recorta; el recorte se
  documenta y no se deforma la imagen.

### RF-06.3 — La misma tapa en las tres ediciones

La fotografía de tapa aparece en:

- **Sitio:** fondo de la sección `.landing` (ya implementado, cambia la fuente).
- **PDF:** la portadilla lleva la fotografía; la titulación se compone sobre ella
  o debajo, según legibilidad.
- **EPUB:** se incorpora una imagen de portada declarada como
  `properties="cover-image"` en el manifiesto del paquete, que hoy no existe. Sin
  ella, ninguna biblioteca ni lector muestra miniatura del libro.

### RF-06.4 — Legibilidad de la titulación sobre la fotografía

El título y el subtítulo deben leerse sobre la fotografía sin depender del
contraste natural de la imagen: velo, banda o zona de reserva. El contraste del
texto contra el fondo efectivo cumple WCAG AA (4,5 : 1 para el cuerpo, 3 : 1 para
la titulación de gran tamaño).

### RF-06.5 — Crédito de la fotografía de tapa

El crédito de la imagen de tapa se consigna en la página de créditos
([RF-01.4](spec-01-orden-de-prelacion.md)) y en el colofón del sitio.

### RF-06.6 — Metadatos sociales actualizados

`og:image` (`src/layouts/Base.astro:19`) apunta a la nueva imagen y se genera un
derivado con las proporciones que las redes esperan (1200 × 630).

## 3. Criterios de aceptación

- **CA-06.1** — `rg -n "fondo-tapa" src/ scripts/` no devuelve ninguna referencia
  activa a la imagen generada.
- **CA-06.2** — La tapa del sitio muestra una fotografía real de la Brigada.
- **CA-06.3** — La portadilla del PDF lleva esa misma fotografía.
- **CA-06.4** — El EPUB declara una `cover-image` en `content.opf` y el lector
  muestra miniatura.
- **CA-06.5** — El contraste del título sobre la tapa cumple WCAG AA, medido.
- **CA-06.6** — El crédito de la fotografía de tapa figura en créditos y colofón.

## 4. Impacto técnico

| Archivo | Cambio |
|---------|--------|
| `scripts/optimize-images.mjs:194-213` | Nueva fuente de tapa; derivado social 1200 × 630 |
| `src/components/Landing.astro` | Nueva imagen; velo o banda de legibilidad |
| `src/layouts/Base.astro:19` | `og:image` |
| `scripts/build-pdf.mjs` | Portadilla con fotografía |
| `scripts/build-epub.mjs` | Documento de portada + `cover-image` en el manifiesto |
| `src/styles/print.css` | Composición de la portadilla ilustrada |

## 5. Nota sobre el collage

El collage actual está bien resuelto y el trabajo no se descarta por calidad. Se
reemplaza por un criterio documental: en un libro que reconstruye hechos probados
en juicio, la imagen de tapa tiene que ser verificable. Si el equipo quiere
conservar la idea de composición, puede rehacerse el collage con fotografías
reales del archivo.
