# Juicio y Castigo en el Chaco (Vol II)

Sitio web del libro **Juicio y Castigo en el Chaco (Vol II) — Causa Brigada I, II, III**, crónicas de los tres juicios por crímenes de lesa humanidad cometidos en el centro clandestino de detención de la Brigada de Investigaciones de la Policía del Chaco.

Comisión Provincial por la Memoria — Chaco.

El sitio se lee como el libro: una sola página, de la tapa al final del anexo, en un solo scroll. Desde ahí se descarga el mismo contenido en PDF A5 y en EPUB.

---

## Cómo está armado

Tres ediciones salen del **mismo markdown**, con el **mismo anclaje de imágenes**: el sitio, el PDF y el EPUB. Si una crónica cambia, cambian las tres.

```
src/content/book/*.md ─┬─→ Astro          → dist/            (el sitio)
                       ├─→ scripts/build-pdf.mjs   → PDF A5
                       └─→ scripts/build-epub.mjs  → EPUB
```

Lo que las une es `src/lib/rehype-anchor-images.mjs`, el plugin que inserta cada fotografía junto al párrafo que ilustra. Los tres destinos lo usan; solo cambia qué markup emite para una imagen.

### Los tres tipos de página

| Tipo | Dónde se usa | Qué hace |
|---|---|---|
| `landing` | La tapa | Imagen a sangre completa, el título encima, se va hacia arriba al scrollear |
| `chapter-opening` | Apertura de cada parte | Fotografía arriba con borde curvo, número de parte y título con banda. En el PDF la imagen ocupa la primera página y el texto la segunda |
| `reader` | Las crónicas | El split reader: placa fija a la izquierda, texto que scrollea a la derecha |
| `interlude` | Las viñetas entre bloques | Retrato o cita a página completa sobre fondo tintado |

### El split reader

La placa de la izquierda muestra la fotografía anclada al título que estás leyendo. Cuando ese título no tiene imagen, la placa queda vacía en el color del fondo — así lo pide la especificación.

Un título largo sostiene una **secuencia** de imágenes: la placa va pasando de una a otra a medida que scrolleás. Por eso las figuras se distribuyen entre los párrafos y no se apilan bajo el título.

En celular la placa desaparece y cada imagen aparece en línea, debajo del título al que pertenece. El epígrafe se ve al tocarla.

---

## El anclaje de las imágenes

**El manuscrito original no traía ninguna referencia a imágenes.** Había 105 fotografías por un lado, 241 títulos por el otro, y un archivo de epígrafes suelto. Nada las unía.

El anclaje se construyó leyendo las crónicas y cruzando cada epígrafe con el texto que lo menciona — nombres de sobrevivientes, de represores, de jueces y fiscales; causas; fechas de audiencia. Cada anclaje quedó registrado con un **puntaje de confianza y su razonamiento**.

```
scripts/proposed-anchors.json   ← las propuestas, con su razonamiento
        ↓  scripts/build-image-map.mjs   (valida, resuelve conflictos)
src/data/image-map.json         ← el mapa que consumen las tres ediciones
```

La validación es estricta: un título que no existe se rechaza, y cuando dos imágenes reclaman el mismo título la de menor confianza se corre al título libre más cercano del mismo documento antes de darse por vencida.

### La lista de revisión

`src/data/image-map.json` trae un campo `review` con **los anclajes que conviene que revise una persona**, de menor a mayor confianza. Para verla en limpio:

```bash
npm run revision
```

Corregir un anclaje es editar su entrada en `scripts/proposed-anchors.json` y volver a correr `npm run map`. El mapa se regenera entero, de forma reproducible.

---

## Las imágenes

Los originales de `src/images/content/` son **278 MB de escaneos y fotografías de prensa de archivo**. No se publican nunca: quedan versionados como material de archivo y todo lo que llega al navegador se deriva de ellos por adelantado.

```bash
npm run images
```

| Destino | Qué genera | Peso |
|---|---|---|
| `public/img/` | AVIF y WebP responsive, más un placeholder de 12 px | 54 MB |
| `build/print/` | Masters a 1750 px para el PDF A5 | 30 MB |
| `build/epub/` | Derivados a 1400 px para el EPUB | 17 MB |

Se derivan una vez y se comitean. **La compilación en CI no toca ninguna imagen** — 105 escaneos de archivo no entran en el presupuesto de un runner de GitHub Actions.

### Calidad de impresión

De las 105 imágenes, **22 no llegan a 300 dpi al ancho de caja de un A5** y **8 están por debajo de 200 dpi**. No es un impedimento para el PDF digital, pero en la maqueta de impresión esas 8 quedan limitadas a media caja: a ese tamaño su blandura se lee como una foto de archivo chica y no como un defecto.

Son: `002, 005, 027, 053, 055, 077, 078, 098`. Si aparecieran originales de mejor resolución, reemplazarlos en `src/images/content/` y volver a correr `npm run images` alcanza.

---

## Comandos

```bash
npm install

# Preparar el contenido (una vez, o cuando cambie el material)
npm run normalize      # los .md originales → colección de Astro con frontmatter
npm run captions       # epigrafes-images-contenido.md → captions.json
npm run map            # las propuestas de anclaje → image-map.json
npm run images         # 278 MB de originales → todos los derivados

# Desarrollo
npm run dev
npm run build          # Astro + índice de Pagefind
npm run check          # verifica que no falte ningún asset ni ninguna imagen

# Las ediciones descargables
npm run pdf            # A5, 300+ páginas, con folios e índice interno
npm run epub           # EPUB 3 reflowable
npm run downloads      # registra el peso real de ambos en el panel de descarga
```

`npm run shots` levanta capturas del sitio en `build/shots/` para revisión visual.

---

## El PDF

A5 (148 × 210 mm), fondo claro y letras oscuras para que sea barato imprimir.

Lo pagina **Chrome**, no un polyfill: su motor resuelve viudas, huérfanas y cortes de figura mejor que cualquier alternativa en JavaScript, y ya está instalado. Después `pdf-lib` estampa los folios y arma el índice interno — Chrome no sabe saltear la tapa al numerar.

- Ninguna imagen se corta entre páginas ni ocupa más de una hoja.
- Ninguna imagen está rotada: no hace falta girar el libro.
- Los folios arrancan después de la tapa y la contratapa.
- El índice interno tiene 234 marcadores navegables.

## El EPUB

EPUB 3 reflowable, escrito directamente y no a través de un conversor: el libro son 24 documentos de estructura conocida, y armar el contenedor a mano deja el orden de lectura, la navegación y el tamaño de las imágenes exactamente como los necesita un celular.

Incluye documento de navegación EPUB 3, `toc.ncx` para lectores viejos y metadatos de accesibilidad.

---

## Accesibilidad

El texto alternativo de cada fotografía es **el epígrafe que escribió el archivo**. Nada se describe por conjetura: una imagen sin epígrafe se declara decorativa en lugar de inventarle una descripción. Son fotografías de víctimas y de represores en un libro sobre terrorismo de Estado; describir de más sería afirmar cosas que nadie afirmó.

El sitio se lee entero sin JavaScript. Lo que el script agrega es la placa fija, los dos paneles, el visor de imágenes y la memoria de lectura.

---

## Publicación

GitHub Pages, vía `.github/workflows/deploy.yml` en cada push a `main`.

El workflow toma `SITE_BASE` del nombre del repositorio. Para un sitio de usuario u organización (`<usuario>.github.io`), poner `SITE_BASE: /`.

**Antes del primer deploy** hay que habilitar Pages en la configuración del repositorio, con origen *GitHub Actions*.

---

## Estructura

```
source/content-original/   Los .md tal como llegaron, intactos
src/
  content/book/            Los mismos textos con frontmatter tipado
  data/                    Todo lo generado: mapa de imágenes, epígrafes, índices
  images/content/          105 originales de archivo (278 MB, no se publican)
  edificio/                19 planos y modelos 3D de la ex Brigada
  components/              Las cuatro maquetas, los tres modales, los controles
  lib/                     El plugin de anclaje y el acceso a los datos
  scripts/book.ts          El comportamiento del cliente
  styles/                  cpm.css (design system) · book.css (sitio) · print.css (A5)
scripts/                   Normalización, epígrafes, mapa, imágenes, PDF, EPUB
public/descargas/          El PDF y el EPUB que sirve el botón Descargar
```

---

## Pendiente

- **Los 19 planos del edificio no tienen epígrafe.** La sección `/edificio` está construida y los rotula con el nombre con que cada archivo llegó al acervo, marcado como *epígrafe pendiente*. Faltan los textos de la CPM.
- **Créditos y legales**: ISBN, colofón y licencia. El colofón ya lista los créditos fotográficos derivados de los propios epígrafes; 32 de 105 imágenes no tienen crédito asentado en el archivo.
- **La lista de revisión editorial** de los anclajes de imagen (`npm run revision`).
