# Spec 07 — Paleta cromática monocroma por sección

**Ediciones afectadas:** sitio, PDF, EPUB
**Origen:** especificaciones02.md, «Gama de colores» y el bloque final del resumen

## 1. Punto de partida

La devolución descarta explícitamente su propia primera idea:

> «Tal vez puedan ser una paleta cromática por cada sección: la primera azul, la
> segunda amarilla, la tercera roja, la cuarta rosa, la quinta verde
> — **nO, eso es una boludez, me pongo a pensar y queda como un manual. No.**»

Y la reemplaza:

> «Capaz mejor una variación por saturación o luminosidad (un solo tono, distinta
> intensidad). Una sola familia de color pero en diferentes tonos para mostrar las
> distintas secciones.»

Ese es el requisito. **Queda fuera de alcance** asignar matices distintos por
sección.

Estado actual: existe una sola escala de acento, azul, ya completa de 100 a 900
(`src/styles/cpm.css:34-42`), aplicada de manera uniforme en todo el libro. El PDF
y el EPUB tienen los valores repetidos a mano (`#145575`, `#1e81b0`, `#9fcde3`,
`#196b93` en `src/styles/print.css` y en `scripts/build-epub.mjs`).

## 2. Requisitos

### RF-07.1 — Un solo matiz, siete intensidades

Cada bloque del libro recibe un escalón de la **misma** escala cromática. La
progresión va de la intensidad plena hacia variantes más bajas:

| Bloque | Escalón sugerido |
|--------|------------------|
| Inicio | `--color-accent-800` |
| Primera parte | `--color-accent-700` (tono pleno / profundo) |
| Segunda parte | `--color-accent-600` |
| Tercera parte | `--color-accent-500` |
| Cuarta parte | `--color-accent-600` |
| Quinta parte | `--color-accent-700` |
| Anexo | `--color-accent-800` |

La asignación exacta es ajustable; lo que no es negociable es que todos los
escalones pertenezcan a la misma familia y que la diferencia entre bloques
contiguos sea perceptible sin ser estridente.

### RF-07.2 — Un único token por sección

Se define un token `--section-accent` (más los derivados que hagan falta:
`--section-accent-soft`, `--section-accent-strong`) resuelto por sección.

- **Sitio:** se aplica sobre el atributo `data-section` que los componentes ya
  emiten (`SplitReader.astro:34`, `ChapterOpening.astro:25`,
  `Interlude.astro:20`).
- **PDF:** cada `<section class="doc">` recibe el mismo atributo y el CSS de
  impresión resuelve el token.
- **EPUB:** cada documento XHTML lleva el atributo en su `<section>` y el CSS del
  paquete resuelve el token.

Ningún generador vuelve a llevar colores literales: los valores viven en un solo
lugar y las tres ediciones los consumen.

### RF-07.3 — Alcance de la aplicación del color

El tono de sección se aplica a: títulos, número de parte, filetes y separadores,
banda de la titulación, borde de citas y créditos de epígrafe.

**No** se aplica a: color del texto de lectura, fondo de página ni fondo de
bloques extensos. El libro sigue siendo texto oscuro sobre fondo claro, para que
la impresión siga siendo barata (requisito heredado de las especificaciones
iniciales).

### RF-07.4 — Contraste garantizado en todos los escalones

Todo escalón usado sobre fondo claro cumple WCAG AA: 4,5 : 1 para texto de
cuerpo, 3 : 1 para titulación grande. Los escalones que no lleguen se corrigen o
se descartan de la progresión.

### RF-07.5 — El matiz base es configurable

> «eso se puede variar de modo automático, para probar?»

La escala se deriva de un matiz base configurable en tiempo de generación
—variable de entorno o constante única— de modo que se pueda producir el sitio,
el PDF y el EPUB con otro tono sin tocar más de un valor.

Requisitos:

- La derivación conserva las relaciones de luminosidad de la escala actual, para
  que el contraste de RF-07.4 se sostenga en cualquier matiz.
- El valor por defecto es el azul actual (`#1e81b0`), que la devolución aprueba.
- Cambiar el matiz no requiere regenerar imágenes.

> **Pendiente P4:** si el equipo quiere probar otros tonos, esta variable es el
> punto de entrada. La decisión final no bloquea la implementación.

### RF-07.6 — La variación es continua, no un código

El cambio de tono acompaña la lectura; no se explica ni se rotula. No hay
leyenda, ni referencia de colores, ni indicación de que cada parte tiene «su»
color. Es lo que distingue esta solución del manual escolar que la devolución
rechaza.

## 3. Criterios de aceptación

- **CA-07.1** — Todos los tonos de sección pertenecen a una única familia
  cromática: mismo matiz, distinta intensidad.
- **CA-07.2** — Existe un solo lugar en el repositorio donde se definen esos
  valores, y las tres ediciones lo consumen.
- **CA-07.3** — Los colores literales de `src/styles/print.css` y del bloque
  `STYLES` de `scripts/build-epub.mjs` fueron reemplazados por tokens.
- **CA-07.4** — Todo escalón en uso cumple WCAG AA sobre fondo claro, con la
  medición registrada.
- **CA-07.5** — Cambiar una sola variable de entorno produce las tres ediciones
  con otro matiz base, sin regenerar imágenes.
- **CA-07.6** — El fondo del libro sigue siendo claro y el texto oscuro en las
  tres ediciones.

## 4. Impacto técnico

| Archivo | Cambio |
|---------|--------|
| `src/styles/cpm.css:34-42` | Escala derivada del matiz base configurable |
| `src/lib/site.mjs` | Constante del matiz base, leída también por los generadores |
| `src/styles/book.css` | Uso de `--section-accent` |
| `src/styles/print.css` | Tokens en lugar de literales; tono por sección |
| `scripts/build-epub.mjs` (`STYLES`) | Tokens en lugar de literales |
| `scripts/build-pdf.mjs` | `data-section` en cada sección impresa |
| `scripts/manifest.mjs` | Escalón asignado a cada sección |
