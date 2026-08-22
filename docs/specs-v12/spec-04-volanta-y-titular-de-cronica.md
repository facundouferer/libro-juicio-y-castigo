# Spec 04 — Volanta y titular: jerarquía tipográfica de las crónicas

**Ediciones afectadas:** Sitio, PDF, EPUB
**Origen:** `especificaciones03.md`, sección «Títulos de crónicas y separaciones»
**Depende de:** —

## 1. Problema observado

> «**Hay una jerarquía tipográfica invertida:** La volanta (Causa/Fecha) jamás
> debe competir en cuerpo ni peso con el titular. Si la volanta tiene 14 pt, el
> título debe ir en 24 pt o superior. La volanta guía; el título jerarquiza. Más
> grande el título.»

El manuscrito escribe cada crónica así:

```markdown
# CAUSA BRIGADA I 7 julio 2010                                    ← volanta
## “LA TORTURA EN EL CHACO COMENZÓ EN EL 74…”                     ← titular
```

Es decir: la volanta como `h1` y el titular como `h2`. Y como el CSS asigna
cuerpos por nivel —17 pt al `h1`, 13 pt al `h2` en
`src/styles/print.css:56-57`; `clamp(28px,3.2vw,42px)` y
`clamp(22px,2.3vw,30px)` en `src/styles/book.css:573-574`— la volanta sale un
30 % más grande que el titular en las tres ediciones. Exactamente al revés.

El nivel de encabezado del manuscrito describe la **estructura del documento**,
no la jerarquía visual. Hay que separar las dos cosas.

## 2. Requisitos

### RF-04.1 — Reconocimiento de la volanta

Un `h1` dentro de un documento de cuerpo es una **volanta de crónica** cuando su
texto menciona la causa: coincide con `/\b(brigada|caballero)\b/i`.

Verificado sobre el corpus actual: de los 36 `h1` del libro, ese patrón reconoce
34 y excluye correctamente los dos que no son volantas —
«CHACHI. Gregorio "Chachi" Quintana 1955-2010.» (título de un interludio) y
«SENTENCIA: JUICIO Y CASTIGO RECARGADO» (subtítulo interno de «Las condenas»).

### RF-04.2 — La clasificación es auditable y corregible

El patrón de RF-04.1 es un valor por defecto, no un dogma. Se acompaña de:

- una lista de excepciones en `scripts/manifest.mjs` (`volantaOverride`), que
  puede forzar o negar la clasificación de un encabezado concreto;
- un informe que `npm run revision` imprime y deja en
  `build/revision-volantas.md`, con los 36 encabezados y su clasificación, para
  que un cambio en el manuscrito no altere la maqueta en silencio.

### RF-04.3 — Un titular es el `h2` inmediatamente posterior a una volanta

Cuando el bloque que sigue a una volanta es un `h2`, ese `h2` es el **titular de
la crónica** y recibe el cuerpo dominante. Si entre la volanta y el primer `h2`
hay texto de cuerpo —ocurre en «Las condenas»— la volanta abre la crónica sola y
ese `h2` posterior es un subtítulo ordinario.

### RF-04.4 — Escala tipográfica

La relación entre titular y volanta nunca baja de **1,7:1** en cuerpo, y la
volanta nunca supera en peso al titular.

**PDF A5:**

| Pieza | Antes | Ahora |
|-------|-------|-------|
| Volanta de crónica | 17 pt (como `h1`) | **9 pt**, Oswald 600, versal, tracking 0.08em, color de acento |
| Titular de crónica | 13 pt (como `h2`) | **19 pt**, Oswald 700, color de acento |
| `h1` ordinario (no volanta) | 17 pt | 16 pt |
| `h2` ordinario (subtítulo) | 13 pt | 12 pt |
| `h3` / `h4` | 11 / 9,8 pt | sin cambio |

Relación titular/volanta: 19/9 = **2,1**.

**Sitio:**

| Pieza | Ahora |
|-------|-------|
| Volanta | `clamp(13px, 1.1vw, 16px)`, versal, tracking |
| Titular | `clamp(30px, 3.4vw, 46px)` |
| `h2` ordinario | `clamp(22px, 2.3vw, 30px)` (sin cambio) |

**EPUB:** volanta `0.78em`; titular `1.62em`.

### RF-04.5 — La volanta deja de ser un encabezado semántico

En el marcado, la volanta se emite como `<p class="cronica-volanta">` dentro de
un `<header class="cronica-head">` que la agrupa con su titular, y el titular
pasa a `<h2 class="cronica-title">`. Consecuencias buscadas:

- el índice interno del PDF y la navegación del EPUB dejan de listar 34 entradas
  «CAUSA BRIGADA I …» y pasan a listar los titulares, que es lo que sirve para
  navegar;
- el índice del sitio hace lo mismo;
- un lector de pantalla anuncia un solo encabezado por crónica, con la volanta
  como texto que lo precede.

### RF-04.6 — El `id` de anclaje se preserva

Las claves del mapa de imágenes (`src/data/image-map.json`) son los `slug` de los
encabezados actuales. Al cambiar de nivel, el `id` generado **no debe cambiar**:
`cronica-title` conserva el `id` que hoy tiene el `h2`, y la volanta conserva el
que hoy tiene el `h1`. Si alguno cambiara, el mapa de imágenes quedaría huérfano.

## 3. Criterios de aceptación

- **CA-04.1** — `build/revision-volantas.md` existe y clasifica 34 volantas y 2
  no-volantas, con la nómina completa.
- **CA-04.2** — En `build/pdf/libro.html` no queda ningún `<h1>` proveniente del
  manuscrito —es decir, ninguno que no sea `.doc-title` ni `.part-title`— cuyo
  texto coincida con `/\b(brigada|caballero)\b/i`. Los títulos que emite el
  compositor quedan fuera: varios nombran a la Brigada porque el libro trata
  sobre ella («La Brigada: tres procesos, un juicio y castigo»).
- **CA-04.3** — En `src/styles/print.css`, `cuerpo(.cronica-title) /
  cuerpo(.cronica-volanta) >= 1.7`. Idem en el CSS del sitio y en el del EPUB.
- **CA-04.4** — El índice interno del PDF no contiene entradas «CAUSA BRIGADA…»;
  contiene los 34 titulares.
- **CA-04.5** — Todo `id` referenciado por `src/data/image-map.json` existe en el
  HTML renderizado de las tres ediciones. Lo verifica `npm run check`.
- **CA-04.6** — Cada `header.cronica-head` contiene a lo sumo una volanta y a lo
  sumo un titular, en ese orden.

## 4. Archivos afectados

- `src/lib/rehype-cronica-heads.mjs` — **nuevo**: plugin rehype que reconoce
  volanta + titular y arma el `header`.
- `scripts/manifest.mjs` — `volantaOverride`.
- `scripts/lib/render-book.mjs:76-88` — registrar el plugin antes del de imágenes.
- `astro.config.mjs` — registrarlo en la cadena del sitio.
- `scripts/report-review.mjs` — informe de volantas.
- `src/styles/print.css:50-60`, `src/styles/book.css:563-580`,
  `scripts/build-epub.mjs:63-77` — escalas.
