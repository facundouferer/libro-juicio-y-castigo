# Spec 02 — Firmas y títulos de los textos del frente

**Ediciones afectadas:** Sitio, PDF, EPUB
**Origen:** `especificaciones03.md`, secciones «Textos de organismos al principio» y «Texto de introducción»
**Depende de:** —

## 1. Problema observado

> «Lo de las notas que faltaban está resuelto. Pero le pusiste Declaración. Es
> simplemente "Por organismos de DDHH de CPM CHACO" antes de comenzar el texto,
> no de volanta.»

> «La firma que vaya igual que el caso anterior, antes del texto. Así se
> identifica la pertenencia de la voz desde el principio. Ya que estamos en vez
> de Introducción, que repita el título del libro. "Juicio y Castigo en el Chaco
> Vol II. La Brigada".»

Tres cosas distintas:

1. **La volanta inventada.** `scripts/manifest.mjs:131` puso
   `kicker: 'Declaración de los organismos de derechos humanos — CPM Chaco'`
   encima del título. Es una calificación editorial que nadie escribió y, además,
   está en el lugar equivocado: una volanta anuncia el tema, no la autoría.
2. **Las firmas están al final.** Ambos textos ya vienen firmados, pero abajo:
   - `src/content/book/03-la-memoria-y-la-palabra.md` cierra con la nómina
     «Organismos de DDHH integrantes de la **CPM CHACO**» y las cuatro
     organizaciones que la integran.
   - `src/content/book/04-introduccion.md` cierra con
     «**Gonzalo Torres 12/8/2025**» y una nota entre paréntesis sobre los otros
     volúmenes de la serie.

   Quien lee no sabe de quién es la voz hasta terminar.
3. **«Introducción» no dice nada.** El texto que abre el libro debe llevar el
   título del libro.

## 2. Requisitos

### RF-02.1 — Nueva pieza editorial: la firma de autoría (`byline`)

Se incorpora al manifiesto un campo `byline`, distinto de `kicker`:

| Campo | Posición | Función |
|-------|----------|---------|
| `kicker` | **encima** del título | volanta: anuncia el tema |
| `byline` | **debajo** del título y **antes** del primer párrafo | firma: identifica la voz |

Las tres ediciones lo renderizan en esa posición y con estilo de firma: cuerpo
menor que el del texto, versalita o mayúscula sostenida, color de acento de la
sección, sin punto final.

### RF-02.2 — El texto de organismos se firma «Por organismos de DDHH de CPM CHACO»

- Se **elimina** el `kicker` `'Declaración de los organismos de derechos humanos
  — CPM Chaco'` de `scripts/manifest.mjs:131`.
- Se agrega `byline: 'Por organismos de DDHH de CPM CHACO'`, con esa
  literalidad.
- El título del documento no cambia: «La memoria y la palabra: los juicios al
  genocidio».

### RF-02.3 — El texto de la introducción se titula con el título del libro

`scripts/manifest.mjs:137` cambia de `'Introducción'` a:

```
Juicio y Castigo en el Chaco Vol II. La Brigada
```

con esa literalidad, incluida la ausencia de coma antes de «Vol II». El `docSlug`
`introduccion` **no cambia**: es la clave del mapa de imágenes, del índice de
títulos y de los anclajes; renombrarlo rompería los tres.

Se agrega `byline: 'Por Gonzalo Torres'`.

### RF-02.4 — Las firmas se mueven, no se duplican

Decisión D1 del equipo editorial. En ambos textos, el bloque de firma que hoy
cierra el documento se retira del cuerpo y lo reemplaza el `byline` de arriba. Lo
que **sí** queda al pie, en cuerpo de nota y sin repetir el nombre de quien firma:

- En el texto de organismos: la nómina de las cuatro organizaciones
  (Asociación de Ex Detenidos Políticos de Chaco; Reg. H.I.J.O.S Chaco en la Red
  Nacional; Familiares de Detenidos y Desaparecidos por Razones Políticas;
  Comisión Permanente por los DDHH).
- En la introducción: la fecha (12 de agosto de 2025) y la nota entre paréntesis
  sobre los volúmenes 1 y 3 de la serie.

Ese pie se marca como `<aside class="signoff">` para que las tres ediciones lo
compongan como nota y no como párrafo de cuerpo.

### RF-02.5 — La corrección se hace en el origen

Los `.md` de `src/content/book/` los regenera `npm run normalize` desde
`source/content-original/`. Editar sólo el destino haría que la próxima
normalización deshiciera el cambio. La reubicación de las firmas se implementa en
`scripts/normalize-content.mjs`, con el mismo criterio con que ya trata las notas
al pie (`scripts/normalize-content.mjs:66-100`): la convención de autoría del
manuscrito se traduce a marcado que las tres ediciones pueden componer.

## 3. Criterios de aceptación

- **CA-02.1** — `scripts/manifest.mjs` no contiene la cadena `'Declaración de los
  organismos'`; la entrada `la-memoria-y-la-palabra` tiene
  `byline: 'Por organismos de DDHH de CPM CHACO'` y ningún `kicker`.
- **CA-02.2** — La entrada `introduccion` tiene
  `title: 'Juicio y Castigo en el Chaco Vol II. La Brigada'` y
  `byline: 'Por Gonzalo Torres'`; su `slug` sigue siendo `introduccion`.
- **CA-02.3** — En las tres ediciones, la firma aparece **después** del `<h1>` del
  documento y **antes** de su primer `<p>`. Verificable por orden de nodos en
  `build/pdf/libro.html`, en `build/epub/` y en `dist/index.html`.
- **CA-02.4** — Ni «Gonzalo Torres» ni «Organismos de DDHH integrantes» aparecen
  dos veces dentro del mismo documento en ninguna edición.
- **CA-02.5** — El índice impreso y el del EPUB muestran «Juicio y Castigo en el
  Chaco Vol II. La Brigada» en lugar de «Introducción».
- **CA-02.6** — Tras `npm run normalize`, los cambios persisten (no vuelve la
  firma al final ni el `kicker` eliminado).

## 4. Archivos afectados

- `scripts/manifest.mjs:126-141` — `kicker` → `byline`, título de la introducción.
- `scripts/normalize-content.mjs` — extracción y reubicación de la firma.
- `src/components/SplitReader.astro:57-68` — render del `byline`.
- `scripts/build-pdf.mjs:205-216` — render del `byline` en `.doc-head`.
- `scripts/build-epub.mjs:347-353` — ídem para el EPUB.
- `src/styles/print.css`, `src/styles/book.css`, CSS embebido del EPUB — estilo de
  `.doc-byline` y `.signoff`.
