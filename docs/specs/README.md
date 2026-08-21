# Especificaciones — segunda revisión editorial

Origen: [`docs/especificaciones02.md`](../especificaciones02.md) (devolución editorial sobre la primera maqueta).

Estas especificaciones traducen esa devolución en requisitos verificables. Cada
requisito lleva un identificador estable (`RF-NN.M`) para poder referenciarlo
desde tareas, commits y revisiones.

## Principio rector

Las tres ediciones —sitio, PDF A5 y EPUB— se generan desde **una sola fuente**:
`src/content/book/*.md` más el manifiesto editorial `scripts/manifest.mjs`.
Ningún requisito puede resolverse parcheando una sola salida: salvo que la
especificación diga explícitamente lo contrario, todo cambio se define en la
fuente común y se realiza en las tres ediciones.

Cadena de generación vigente:

```
src/content/book/*.md ─┬─> src/pages/index.astro           (sitio)
scripts/manifest.mjs   ├─> scripts/build-pdf.mjs           (PDF A5)
src/data/*.json        └─> scripts/build-epub.mjs          (EPUB 3)
                            ambos vía scripts/lib/render-book.mjs
                            + src/lib/rehype-anchor-images.mjs
```

## Índice de especificaciones

| ID | Especificación | Ediciones | Depende de |
|----|----------------|-----------|------------|
| [01](spec-01-orden-de-prelacion.md) | Orden de prelación de las primeras páginas | Sitio, PDF, EPUB | — |
| [02](spec-02-titulacion-y-jerarquia.md) | Titulación y jerarquía tipográfica | Sitio, PDF, EPUB | — |
| [03](spec-03-flujo-de-texto-y-paginacion.md) | Flujo de texto y paginación del PDF | PDF | 04 |
| [04](spec-04-secuencia-de-imagenes.md) | Secuencia y unicidad de las imágenes | Sitio, PDF, EPUB | — |
| [05](spec-05-separadores-digitales.md) | Separadores en las ediciones digitales | Sitio, EPUB | 02 |
| [06](spec-06-tapa-fotografia-real.md) | Tapa: fotografía real en lugar de imagen generada | Sitio, PDF, EPUB | — |
| [07](spec-07-paleta-cromatica.md) | Paleta cromática monocroma por sección | Sitio, PDF, EPUB | — |

## Orden de trabajo sugerido

1. **04** (secuencia de imágenes) antes que **03**: la paginación del PDF sólo
   tiene sentido evaluarla una vez que las imágenes están en su orden definitivo.
2. **02** antes que **05**: los separadores digitales se apoyan en la jerarquía
   de títulos que define la 02.
3. **01**, **06** y **07** son independientes entre sí y pueden avanzar en paralelo.

## Decisiones pendientes del equipo editorial

Estas especificaciones quedan completas salvo por insumos que no están en el
repositorio. Se listan acá y se repiten en la especificación correspondiente:

| # | Insumo | Bloquea |
|---|--------|---------|
| P1 | Texto de créditos, legales, datos de impresión y copyleft | RF-01.4 |
| P2 | Fotografía definitiva de la fachada de la Brigada para la tapa | RF-06.2 |
| P3 | Confirmación de cuáles imágenes casi idénticas se descartan | RF-04.4 |
| P4 | Tono base de la escala cromática (se mantiene el azul actual o se prueba otro) | RF-07.5 |

## Convenciones

- **RF** — requisito funcional, obligatorio salvo indicación contraria.
- **CA** — criterio de aceptación: cómo se verifica que el RF está cumplido.
- Toda referencia a código usa la forma `ruta/archivo.ext:línea`.
