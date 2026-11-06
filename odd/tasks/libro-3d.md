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
- S8. "Plano inicial abierto: cámara alejada, mostrando el escritorio completo y el libro sobre él. Se debe percibir el espacio de la habitación oscura." → "Acercamiento progresivo" → "Plano de apertura" (the current cover framing) → "Vista cenital" (unchanged). "No modificar la animación original del libro."

## Tasks

- [x] T1 · S7 · inline · Script that renders every PDF page to an image + generated images (`npm run pages`, 314 JPEGs, 48 MB). Commit: build(libro3d).
- [x] T2 · S2-S6 · inline · Three.js scene (table, book, cover, camera, page turn) and `/libro` page. Commit: feat(libro3d).
- [x] T3 · S1 · inline · "Libro" button in the controls. Commit: feat(libro3d).
- [x] T4 · S8 · inline · Finite desk (top, apron, legs) on a dark floor; establishing shot and one curved dolly to the cover view. Commit: feat(libro3d).

## Log

- L1 (2026-11-05): "quiero que investigues y me digas como podrías hacer que el sitio tenga otro un botón al lado de descarga un botón que diga Libro y que te lleve a una animación 3d donde se ve un libro que tiene como portada la primera parte del sitio donde se ve el titulo y también se lee el autor Gonzalo Torres en la portada además de los otros datos, La cámara enfoca la portada del libro y luego el libro se abre en su primera página que es la primera página del PDF y uno puede ver el libro de a dos páginas con una vista de arriba para poder leer bien. Para correr de página uno debe hacer click en las página y el entorno 3d donde está el libro es una mesa de madera. Estudia como hacerlo y me expilcas."
- L2 (2026-11-05): "Sí, implementá" — approved the proposal: build-time page images, cover drawn from the site's cover, procedural wood, curved page turn.
- L3 (2026-11-05): verified with headless Chrome (Playwright) at 1280×800 and 390×844: cover with title, "Por Gonzalo Torres", subtitle, kicker and publisher; camera finds the cover, cover opens on PDF page 1, top view of the spread; clicks on the right page turn forward, on the left page back (3 forward + 1 back → "págs. 4–5"); in portrait one page fills the view. `npm run build` and `npm run check` pass. Not verified: real phones, Safari, low-end GPUs.
- L4 (2026-11-05): "Quiero realizar una modificación exclusivamente en el encuadre y el recorrido de cámara de la animación 3D actual." The old tabletop was an endless 14 × 14 plane, so showing "el escritorio completo, incluyendo su superficie y estructura" needed a finite desk (8.4 × 5.6, legs and apron) plus a dark floor; the tabletop keeps its grain size, so cover and top views look as before. The camera starts wide, waits 0.9 s, then follows one Catmull-Rom curve (wide → old start → cover, 4.6 s) while the fog recedes back to its normal range; the cover pause, opening, page turns and top view are untouched. Verified headless at 1280×800 and 390×844; `npm run check` and `npm run build` pass.
