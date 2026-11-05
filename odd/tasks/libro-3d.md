# Libro 3D

Objective: a "Libro" button next to "Descargar" that opens a 3D book on a wooden table, readable two pages at a time.
Branch: `feat/libro-3d` · Delivery: ask-on-risk · Test runner: none (visual check in the browser + `npm run build` + `npm run check`).

## Specs

- S1. "un botón al lado de descarga un botón que diga Libro y que te lleve a una animación 3d"
- S2. "un libro que tiene como portada la primera parte del sitio donde se ve el titulo y también se lee el autor Gonzalo Torres en la portada además de los otros datos"
- S3. "La cámara enfoca la portada del libro y luego el libro se abre en su primera página que es la primera página del PDF"
- S4. "uno puede ver el libro de a dos páginas con una vista de arriba para poder leer bien"
- S5. "Para correr de página uno debe hacer click en las página"
- S6. "el entorno 3d donde está el libro es una mesa de madera"
- S7 (assumption). Pages come from the published PDF, pre-rendered to images at build time and loaded progressively; without WebGL the page links to the PDF.

## Tasks

- [x] T1 · S7 · inline · Script that renders every PDF page to an image + generated images (`npm run pages`, 314 JPEGs, 48 MB). Commit: build(libro3d).
- [x] T2 · S2-S6 · inline · Three.js scene (table, book, cover, camera, page turn) and `/libro` page. Commit: feat(libro3d).
- [x] T3 · S1 · inline · "Libro" button in the controls. Commit: feat(libro3d).

## Log

- L1 (2026-11-05): "quiero que investigues y me digas como podrías hacer que el sitio tenga otro un botón al lado de descarga un botón que diga Libro y que te lleve a una animación 3d donde se ve un libro que tiene como portada la primera parte del sitio donde se ve el titulo y también se lee el autor Gonzalo Torres en la portada además de los otros datos, La cámara enfoca la portada del libro y luego el libro se abre en su primera página que es la primera página del PDF y uno puede ver el libro de a dos páginas con una vista de arriba para poder leer bien. Para correr de página uno debe hacer click en las página y el entorno 3d donde está el libro es una mesa de madera. Estudia como hacerlo y me expilcas."
- L2 (2026-11-05): "Sí, implementá" — approved the proposal: build-time page images, cover drawn from the site's cover, procedural wood, curved page turn.
- L3 (2026-11-05): verified with headless Chrome (Playwright) at 1280×800 and 390×844: cover with title, "Por Gonzalo Torres", subtitle, kicker and publisher; camera finds the cover, cover opens on PDF page 1, top view of the spread; clicks on the right page turn forward, on the left page back (3 forward + 1 back → "págs. 4–5"); in portrait one page fills the view. `npm run build` and `npm run check` pass. Not verified: real phones, Safari, low-end GPUs.
