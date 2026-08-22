# Especificaciones — versión 1.2 (tercera revisión editorial)

Origen: [`docs/especificaciones03.md`](../especificaciones03.md).

Estas especificaciones traducen esa devolución en requisitos verificables. Cada
requisito lleva un identificador estable (`RF-NN.M`) y su criterio de aceptación
(`CA-NN.M`), para poder referenciarlo desde commits y revisiones.

Ronda anterior: [`docs/specs/`](../specs/README.md) (segunda revisión editorial).
Cuando un requisito de esta ronda corrige o reemplaza a uno de aquella, se dice
explícitamente.

## Principio rector

Sin cambios respecto de la ronda anterior: las tres ediciones —sitio, PDF A5 y
EPUB— se generan desde **una sola fuente**, `src/content/book/*.md` más el
manifiesto editorial `scripts/manifest.mjs`. Ningún requisito se resuelve
parcheando una sola salida.

```
src/content/book/*.md ─┬─> src/pages/index.astro           (sitio)
scripts/manifest.mjs   ├─> scripts/build-pdf.mjs           (PDF A5)
src/data/*.json        └─> scripts/build-epub.mjs          (EPUB 3)
                            ambos vía scripts/lib/render-book.mjs
                            + src/lib/rehype-anchor-images.mjs
```

**Regla de entrega de esta ronda** (`especificaciones03.md`, encabezado): el PDF
y el EPUB regenerados entran en el mismo commit que el código. La spec 09 lo
formaliza.

## Índice de especificaciones

| ID | Especificación | Ediciones | Depende de |
|----|----------------|-----------|------------|
| [01](spec-01-portadilla-interior.md) | Portadilla interior: sin imagen y con jerarquía propia | PDF, EPUB, Sitio | — |
| [02](spec-02-firmas-y-titulos-del-frente.md) | Firmas y títulos de los textos del frente | Sitio, PDF, EPUB | — |
| [03](spec-03-caratulas-de-seccion.md) | Carátula propia para cada sección | Sitio, PDF, EPUB | — |
| [04](spec-04-volanta-y-titular-de-cronica.md) | Volanta y titular: jerarquía tipográfica de las crónicas | Sitio, PDF, EPUB | — |
| [05](spec-05-apertura-de-cronicas-en-impar.md) | Cada crónica abre en página impar | PDF | 04 |
| [06](spec-06-colocacion-de-imagenes.md) | Colocación de las imágenes en el flujo | Sitio, PDF, EPUB | 04, 05 |
| [07](spec-07-formatos-y-contenedores-de-imagen.md) | Formatos y contenedores de imagen | Sitio, PDF, EPUB | 06 |
| [08](spec-08-curaduria-duplicados-y-epigrafes.md) | Curaduría: duplicados y errores de epígrafe | Sitio, PDF, EPUB | — |
| [09](spec-09-publicacion-de-descargas.md) | Publicación del PDF y el EPUB corregidos | Repositorio | 01–08 |

## Orden de trabajo

1. **08** primero: corrige datos de origen (epígrafe de Morresi, duplicados de
   Chachi). Todo lo demás se mide sobre un corpus ya limpio.
2. **04** antes que **05** y **06**: hasta que la crónica no sea una unidad
   reconocible por el código, no se la puede abrir en impar ni anclarle imágenes.
3. **05** antes que **06**: el verso de cortesía que abre la spec 05 es el
   contenedor que la spec 06 llena con imagen a página completa.
4. **01**, **02**, **03** y **07** son independientes.
5. **09** al final, con las tres ediciones ya regeneradas.

## Decisiones tomadas por el equipo editorial

Consultadas y resueltas antes de redactar estas especificaciones:

| # | Cuestión | Decisión |
|---|----------|----------|
| D1 | Firmas que hoy están al final de los textos del frente | **Se mueven**: firma breve antes del texto; la nómina completa de organismos y la fecha quedan en un pie discreto, sin repetir el nombre (spec 02) |
| D2 | Versos que deja el «todas las crónicas en impar» | **Se llenan con imagen a página completa** cuando hay imagen disponible; sólo quedan en blanco si no la hay (spec 05, spec 06) |
| D3 | Maqueta pelada de texto como entregable aparte | **No**: se entrega el libro completo corregido, sin PDF adicional sin imágenes |
| D4 | Qué imágenes van a página completa | **Carátulas de sección y planos/relevamientos del EAAF** (claves `002`, `083`, `084`, `085`, `092`, `093`). El resto va a ancho de caja o a dos tercios centrado (spec 07) |

## Convenciones

- **RF** — requisito funcional, obligatorio salvo indicación contraria.
- **CA** — criterio de aceptación: cómo se verifica que el RF está cumplido.
- Toda referencia a código usa la forma `ruta/archivo.ext:línea`.
- «Recto» = página impar (derecha); «verso» = página par (izquierda).
