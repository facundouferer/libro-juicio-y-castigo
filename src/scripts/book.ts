/**
 * Client behaviour for the book.
 *
 * Everything here is progressive: the book is readable, searchable by anchor
 * and printable with this file never loading. What it adds is the sticky
 * plate, the two panels, the image viewer, and the memory of where the reader
 * left off.
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ══════════════════════════════════════════════════════════════════════════
   The plate
   ══════════════════════════════════════════════════════════════════════ */

interface Anchor {
  /** Distance from the top of the document to this heading. */
  top: number;
  key: string | null;
  caption: string;
  credit: string;
  avif: string;
  webp: string;
  src: string;
  alt: string;
}

interface Plate {
  root: HTMLElement;
  frame: HTMLElement;
  layers: HTMLImageElement[];
  caption: HTMLElement;
  anchors: Anchor[];
  /** Which of the two stacked layers is currently on top. */
  front: number;
  activeKey: string | null;
  /** Decided once by the boot probe; picks which srcset the layers get. */
  avifSupported?: boolean;
}

const plates: Plate[] = [];

/**
 * The reading line: the point down the viewport that decides which heading the
 * reader is "on". A third from the top tracks the eye better than the middle,
 * because the heading sits above the paragraph being read.
 */
const READING_LINE = 0.32;

function buildPlates() {
  plates.length = 0;

  for (const article of document.querySelectorAll<HTMLElement>('.reader')) {
    const root = article.querySelector<HTMLElement>('[data-plate]');
    const prose = article.querySelector<HTMLElement>('[data-prose]');
    if (!root || !prose) continue;

    const layers = [...root.querySelectorAll<HTMLImageElement>('[data-plate-img]')];
    const frame = root.querySelector<HTMLElement>('[data-plate-frame]');
    const caption = root.querySelector<HTMLElement>('[data-plate-caption]');
    if (layers.length < 2 || !frame || !caption) continue;

    const anchors: Anchor[] = [];

    const fromFigure = (figure: HTMLElement, at: HTMLElement): Anchor => {
      const anchor: Anchor = {
        top: 0,
        key: figure.dataset.key ?? null,
        caption: figure.dataset.caption ?? '',
        credit: figure.dataset.credit ?? '',
        avif: figure.dataset.avif ?? '',
        webp: figure.dataset.webp ?? '',
        src: figure.dataset.src ?? '',
        alt: figure.querySelector('img')?.getAttribute('alt') ?? '',
      };
      (anchor as Anchor & { el: HTMLElement }).el = at;
      return anchor;
    };

    const empty = (at: HTMLElement): Anchor => {
      const anchor: Anchor = { top: 0, key: null, caption: '', credit: '', avif: '', webp: '', src: '', alt: '' };
      (anchor as Anchor & { el: HTMLElement }).el = at;
      return anchor;
    };

    // The figures are spread through the paragraphs rather than parked under
    // their heading, so the plate is driven by a sequence of events read in
    // document order, not by a heading-to-figure lookup:
    //
    //   a heading arrives  → show the first of its images, or clear the plate
    //   a later figure     → advance the plate to it
    //
    // Showing a heading's first image at the heading itself matters: waiting
    // until the reader reaches the figure's own position would leave the plate
    // blank through the opening paragraphs of every chronicle.
    const base = prose.querySelector<HTMLElement>('.figure[data-doc-default]');
    if (base) anchors.push(fromFigure(base, prose));

    const nodes = [...prose.querySelectorAll<HTMLElement>('h1, h2, h3, h4, .figure')];
    let pendingHeading: HTMLElement | null = null;

    for (const node of nodes) {
      if (node.classList.contains('figure')) {
        if (node.hasAttribute('data-doc-default')) continue;
        // The first figure after a heading is pulled back onto the heading.
        anchors.push(fromFigure(node, pendingHeading ?? node));
        pendingHeading = null;
      } else {
        // A heading with no images of its own clears the plate; the placeholder
        // is replaced in place if a figure turns up before the next heading.
        anchors.push(empty(node));
        pendingHeading = node;
      }
    }

    // Collapse the placeholder a heading left behind when it did own a figure.
    for (let i = anchors.length - 1; i > 0; i -= 1) {
      const current = anchors[i] as Anchor & { el: HTMLElement };
      const previous = anchors[i - 1] as Anchor & { el: HTMLElement };
      if (current.key && !previous.key && current.el === previous.el) anchors.splice(i - 1, 1);
    }

    if (!anchors.length) continue;
    plates.push({ root, frame, layers, caption, anchors, front: -1, activeKey: null });
  }

  measurePlates();
}

function measurePlates() {
  const pageTop = window.scrollY;
  for (const plate of plates) {
    for (const anchor of plate.anchors) {
      const el = (anchor as Anchor & { el: HTMLElement }).el;
      anchor.top = el.getBoundingClientRect().top + pageTop;
    }
    // The list is built in document order, but the binary search in
    // updatePlates depends on it being sorted by offset — and a figure pulled
    // back onto its heading shares a position with it.
    plate.anchors.sort((a, b) => a.top - b.top);
  }
}

/**
 * The heading whose photograph just landed on the plate is lit for a moment,
 * so the eye can pair the two across the gutter. The timeout must match the
 * heading-glow animation length in book.css.
 */
let litHeading: HTMLElement | null = null;
let litTimer = 0;

function spotlightHeading(el: HTMLElement | undefined) {
  if (!el || !/^H[1-4]$/.test(el.tagName)) return;
  litHeading?.classList.remove('is-lit');
  window.clearTimeout(litTimer);
  // Forces a restyle so the animation restarts when the same heading fires twice.
  void el.offsetWidth;
  el.classList.add('is-lit');
  litHeading = el;
  litTimer = window.setTimeout(() => {
    el.classList.remove('is-lit');
    litHeading = null;
  }, 2600);
}

function showOnPlate(plate: Plate, anchor: Anchor | null) {
  const key = anchor?.key ?? null;
  if (key === plate.activeKey) return;
  plate.activeKey = key;

  if (!key || !anchor) {
    plate.root.classList.remove('has-image');
    for (const layer of plate.layers) layer.classList.remove('is-active');
    plate.caption.textContent = '';
    return;
  }

  const next = (plate.front + 1) % plate.layers.length;
  const layer = plate.layers[next];

  // srcset before src, so the browser picks the right width on first look
  // rather than fetching the fallback and then upgrading.
  layer.setAttribute('sizes', '42vw');
  layer.setAttribute('srcset', plate.avifSupported ? anchor.avif : anchor.webp);
  layer.src = anchor.src;
  layer.alt = anchor.alt;

  const reveal = () => {
    plate.layers[plate.front]?.classList.remove('is-active');
    layer.classList.add('is-active');
    plate.front = next;
    plate.root.classList.add('has-image');
    spotlightHeading((anchor as Anchor & { el?: HTMLElement }).el);
  };

  if (layer.complete && layer.naturalWidth) reveal();
  else layer.addEventListener('load', reveal, { once: true });

  plate.caption.textContent = anchor.caption;
  if (anchor.credit) {
    const credit = document.createElement('span');
    credit.className = 'credit';
    credit.textContent = anchor.credit;
    plate.caption.append(credit);
  }
  plate.root.dataset.key = key;
}

function updatePlates() {
  const line = window.scrollY + window.innerHeight * READING_LINE;

  for (const plate of plates) {
    // The last heading the reader has passed. Binary search — 244 headings
    // across the book and this runs on every animation frame.
    let lo = 0;
    let hi = plate.anchors.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (plate.anchors[mid].top <= line) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    showOnPlate(plate, found === -1 ? null : plate.anchors[found]);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Modals — each grows out of the control that opened it
   ══════════════════════════════════════════════════════════════════════ */

let lastFocus: HTMLElement | null = null;

function openModal(dialog: HTMLDialogElement, origin?: HTMLElement) {
  const panel = dialog.querySelector<HTMLElement>('.modal-panel');
  if (panel && origin) {
    // Translate the button's centre into the panel's own coordinate space so
    // the scale-up appears to start from the control the reader pressed.
    const from = origin.getBoundingClientRect();
    dialog.style.setProperty('--from-x', `${from.left + from.width / 2}px`);
    dialog.style.setProperty('--from-y', `${from.top + from.height / 2}px`);
    requestAnimationFrame(() => {
      const to = panel.getBoundingClientRect();
      if (!to.width) return;
      const ox = ((from.left + from.width / 2 - to.left) / to.width) * 100;
      const oy = ((from.top + from.height / 2 - to.top) / to.height) * 100;
      panel.style.setProperty('--ox', `${Math.max(-40, Math.min(140, ox))}%`);
      panel.style.setProperty('--oy', `${Math.max(-40, Math.min(140, oy))}%`);
    });
  }

  lastFocus = (document.activeElement as HTMLElement) ?? null;
  origin?.setAttribute('aria-expanded', 'true');
  dialog.showModal();
  document.body.classList.add('is-locked');
}

function closeModal(dialog: HTMLDialogElement) {
  const finish = () => {
    dialog.classList.remove('is-closing');
    dialog.close();
    document.body.classList.remove('is-locked');
    for (const button of document.querySelectorAll('[aria-controls]')) {
      if (button.getAttribute('aria-controls') === dialog.id) button.setAttribute('aria-expanded', 'false');
    }
    lastFocus?.focus?.();
  };

  if (reduceMotion) return finish();
  dialog.classList.add('is-closing');
  window.setTimeout(finish, 190);
}

function wireModal(id: string, triggerId?: string) {
  const dialog = document.getElementById(id) as HTMLDialogElement | null;
  if (!dialog) return null;

  const trigger = triggerId ? document.getElementById(triggerId) : null;
  trigger?.addEventListener('click', () => openModal(dialog, trigger));

  for (const button of dialog.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => closeModal(dialog));
  }

  // The backdrop is the dialog element itself; a click landing on it and not
  // on the panel means the reader clicked outside.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeModal(dialog);
  });

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeModal(dialog);
  });

  return dialog;
}

/* ══════════════════════════════════════════════════════════════════════════
   Image viewer
   ══════════════════════════════════════════════════════════════════════ */

function setupZoom() {
  const dialog = wireModal('dlg-zoom');
  if (!dialog) return;

  const stage = dialog.querySelector<HTMLElement>('[data-zoom-stage]')!;
  const img = dialog.querySelector<HTMLImageElement>('[data-zoom-img]')!;
  const caption = dialog.querySelector<HTMLElement>('[data-zoom-caption]')!;

  let scale = 1;
  let tx = 0;
  let ty = 0;

  const apply = () => {
    img.style.setProperty('--scale', String(scale));
    img.style.setProperty('--tx', `${tx}px`);
    img.style.setProperty('--ty', `${ty}px`);
  };

  const zoomBy = (factor: number) => {
    scale = Math.max(1, Math.min(6, scale * factor));
    if (scale === 1) {
      tx = 0;
      ty = 0;
    }
    apply();
  };

  dialog.querySelector('[data-zoom-in]')?.addEventListener('click', () => zoomBy(1.4));
  dialog.querySelector('[data-zoom-out]')?.addEventListener('click', () => zoomBy(1 / 1.4));

  // Drag to pan. Pointer capture keeps the gesture alive when the cursor
  // leaves the image, which it constantly does at high zoom.
  let dragging = false;
  let originX = 0;
  let originY = 0;

  stage.addEventListener('pointerdown', (event) => {
    if (scale <= 1) return;
    // Blocks the browser's native image drag, which would cancel the pan.
    event.preventDefault();
    dragging = true;
    originX = event.clientX - tx;
    originY = event.clientY - ty;
    stage.classList.add('is-panning');
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    tx = event.clientX - originX;
    ty = event.clientY - originY;
    apply();
  });
  const endDrag = () => {
    dragging = false;
    stage.classList.remove('is-panning');
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12);
    },
    { passive: false },
  );

  stage.addEventListener('dblclick', () => zoomBy(scale > 1 ? 1 / 6 : 2.2));

  function open(source: { avif: string; webp: string; src: string; alt: string; caption: string; credit: string }, origin?: HTMLElement) {
    scale = 1;
    tx = 0;
    ty = 0;
    apply();

    img.removeAttribute('srcset');
    img.setAttribute('sizes', '100vw');
    img.setAttribute('srcset', source.avif || source.webp);
    img.src = source.src;
    img.alt = source.alt;

    if (source.caption || source.credit) {
      caption.textContent = source.caption;
      if (source.credit) {
        const credit = document.createElement('span');
        credit.className = 'credit';
        credit.textContent = source.credit;
        caption.append(credit);
      }
      caption.hidden = false;
    } else {
      caption.textContent = '';
      caption.hidden = true;
    }

    openModal(dialog!, origin);
  }

  const fromFigure = (figure: HTMLElement) => ({
    avif: figure.dataset.avif ?? '',
    webp: figure.dataset.webp ?? '',
    src: figure.dataset.src ?? '',
    alt: figure.querySelector('img')?.getAttribute('alt') ?? '',
    caption: figure.dataset.caption ?? '',
    credit: figure.dataset.credit ?? '',
  });

  // Inline figures — the phone path, and the interlude portraits.
  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-zoom]');
    if (!button) return;
    const figure = button.closest<HTMLElement>('.figure');
    if (figure) {
      open(fromFigure(figure), button);
      return;
    }
    // An interlude image: its data lives on the picture, not on a .figure.
    const picture = button.querySelector('img');
    if (!picture) return;
    open(
      {
        avif: button.querySelector('source[type="image/avif"]')?.getAttribute('srcset') ?? '',
        webp: button.querySelector('source[type="image/webp"]')?.getAttribute('srcset') ?? '',
        src: picture.currentSrc || picture.src,
        alt: picture.alt,
        caption: button.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ?? '',
        credit: '',
      },
      button,
    );
  });

  // The magnifier on the plate opens whatever the plate is currently showing.
  for (const button of document.querySelectorAll<HTMLElement>('[data-plate-zoom]')) {
    button.addEventListener('click', () => {
      const plate = button.closest<HTMLElement>('[data-plate]');
      const key = plate?.dataset.key;
      if (!key) return;
      const figure = document.getElementById(`fig-${key}`);
      if (figure) open(fromFigure(figure), button);
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Contents — title filter, then full text
   ══════════════════════════════════════════════════════════════════════ */

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function setupContents() {
  const dialog = wireModal('dlg-contents', 'btn-contents');
  if (!dialog) return;

  const input = dialog.querySelector<HTMLInputElement>('#contents-q')!;
  const list = dialog.querySelector<HTMLElement>('#contents-list')!;
  const results = dialog.querySelector<HTMLElement>('#contents-results')!;
  const hint = dialog.querySelector<HTMLElement>('#contents-hint')!;
  const links = [...list.querySelectorAll<HTMLAnchorElement>('a')];
  const labels = [...list.querySelectorAll<HTMLElement>('[data-section-label]')];
  const haystack = links.map((a) => fold(a.dataset.title ?? a.textContent ?? ''));

  dialog.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest('a');
    if (link) closeModal(dialog);
  });

  let pagefind: { search: (q: string) => Promise<{ results: { data: () => Promise<PagefindResult> }[] }> } | null = null;
  let pagefindFailed = false;

  interface PagefindResult {
    url: string;
    excerpt: string;
    meta?: { title?: string };
    sub_results?: { title: string; url: string; excerpt: string }[];
  }

  async function loadPagefind() {
    if (pagefind || pagefindFailed) return pagefind;
    try {
      // Built by `pagefind --site dist` after the Astro build, so it only
      // exists in a real build — never during `astro dev`.
      const base = document.documentElement.dataset.base ?? '';
      pagefind = await import(/* @vite-ignore */ `${base}/pagefind/pagefind.js`);
      await (pagefind as unknown as { options: (o: object) => Promise<void> }).options({ excerptLength: 24 });
      return pagefind;
    } catch {
      pagefindFailed = true;
      return null;
    }
  }

  function filterTitles(query: string) {
    const needle = fold(query);
    let shown = 0;
    for (const [i, link] of links.entries()) {
      const hit = !needle || haystack[i].includes(needle);
      link.hidden = !hit;
      if (hit) shown += 1;
    }
    // A section header with nothing under it is noise.
    for (const label of labels) {
      let node = label.nextElementSibling;
      let any = false;
      while (node && !node.hasAttribute('data-section-label')) {
        if (node.tagName === 'A' && !(node as HTMLAnchorElement).hidden) {
          any = true;
          break;
        }
        node = node.nextElementSibling;
      }
      label.hidden = !any;
    }
    return shown;
  }

  let token = 0;

  async function run() {
    const query = input.value.trim();
    const shown = filterTitles(query);

    if (query.length < 3) {
      results.hidden = true;
      results.textContent = '';
      hint.textContent = shown
        ? 'Escribí tres letras o más para buscar también dentro del texto.'
        : 'Ningún título coincide.';
      return;
    }

    const mine = ++token;
    const engine = await loadPagefind();
    if (mine !== token) return;

    if (!engine) {
      hint.textContent = shown
        ? `${shown} ${shown === 1 ? 'título' : 'títulos'}. La búsqueda dentro del texto sólo funciona en el sitio publicado.`
        : 'Ningún título coincide. La búsqueda dentro del texto sólo funciona en el sitio publicado.';
      return;
    }

    const search = await engine.search(query);
    if (mine !== token) return;

    // The whole book is one page, so Pagefind returns one or two results whose
    // sub-results are the real hits — one per heading. Slicing those the way a
    // multi-page site would leaves most of the book unreachable from search.
    const top = await Promise.all(search.results.slice(0, 4).map((r) => r.data()));
    if (mine !== token) return;

    results.textContent = '';
    const flat = top.flatMap((entry) =>
      entry.sub_results?.length
        ? entry.sub_results.map((s) => ({ title: s.title, url: s.url, excerpt: s.excerpt }))
        : [{ title: entry.meta?.title ?? 'Resultado', url: entry.url, excerpt: entry.excerpt }],
    );

    if (!flat.length) {
      results.innerHTML = '<p class="contents-empty">Sin coincidencias en el texto.</p>';
    } else {
      for (const item of flat.slice(0, 40)) {
        const wrap = document.createElement('div');
        wrap.className = 'result-item';
        const link = document.createElement('a');
        link.href = item.url.replace(/^.*?(#|$)/, (m, hash) => (hash ? m.slice(m.indexOf('#')) : '#'));
        link.textContent = item.title;
        const excerpt = document.createElement('p');
        excerpt.innerHTML = item.excerpt;
        wrap.append(link, excerpt);
        results.append(wrap);
      }
    }

    results.hidden = false;
    const capped = flat.length > 40 ? ` (se muestran los primeros 40)` : '';
    hint.textContent = `${shown} ${shown === 1 ? 'título' : 'títulos'} · ${flat.length} ${flat.length === 1 ? 'pasaje' : 'pasajes'} en el texto${capped}`;
  }

  let debounce = 0;
  input.addEventListener('input', () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(run, 160);
  });

  document.getElementById('btn-contents')?.addEventListener('click', () => {
    window.setTimeout(() => input.focus(), 120);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Reading position
   ══════════════════════════════════════════════════════════════════════ */

const STORE_KEY = 'jyc:posicion';

function setupMemory() {
  const book = document.body.dataset.book === 'true';
  if (!book) return;

  let store: Storage | null = null;
  try {
    store = window.localStorage;
    store.getItem(STORE_KEY);
  } catch {
    // Private browsing, or storage disabled. The book still reads.
    return;
  }

  const titleOf = (id: string) =>
    document.getElementById(id)?.textContent?.trim() ??
    document.querySelector(`[data-doc="${CSS.escape(id)}"]`)?.getAttribute('aria-label') ??
    '';

  function save() {
    const line = window.scrollY + window.innerHeight * READING_LINE;
    let current = '';
    for (const heading of document.querySelectorAll<HTMLElement>('.prose h1, .prose h2, .prose h3, .prose h4, .doc')) {
      if (heading.getBoundingClientRect().top + window.scrollY > line) break;
      if (heading.id) current = heading.id;
    }
    if (!current) return;
    store!.setItem(
      STORE_KEY,
      JSON.stringify({ id: current, y: Math.round(window.scrollY), at: Date.now(), title: titleOf(current) }),
    );
  }

  // Offer the reader their place instead of teleporting them there — a book
  // that jumps on open is disorienting, and the landing is part of the work.
  const raw = store.getItem(STORE_KEY);
  if (raw && !window.location.hash) {
    try {
      const saved = JSON.parse(raw) as { id: string; y: number; title?: string };
      const target = saved.id && document.getElementById(saved.id);
      if (target && saved.y > window.innerHeight) {
        const toast = document.createElement('div');
        toast.className = 'resume';
        toast.setAttribute('role', 'status');
        toast.innerHTML = `
          <span class="resume-text">
            <b>Seguí leyendo</b>
            <span>${(saved.title || 'Donde te quedaste').slice(0, 70)}</span>
          </span>
          <button class="btn btn-primary" type="button" data-resume>Ir ahí</button>
          <button class="btn btn-secondary" type="button" data-dismiss>Desde el inicio</button>`;
        document.body.append(toast);

        const dismiss = () => toast.remove();
        toast.querySelector('[data-dismiss]')?.addEventListener('click', dismiss);
        toast.querySelector('[data-resume]')?.addEventListener('click', () => {
          target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
          dismiss();
        });
        window.setTimeout(dismiss, 14000);
      }
    } catch {
      store.removeItem(STORE_KEY);
    }
  }

  let idle = 0;
  window.addEventListener(
    'scroll',
    () => {
      window.clearTimeout(idle);
      idle = window.setTimeout(save, 400);
    },
    { passive: true },
  );
  window.addEventListener('pagehide', save);
}

/* ══════════════════════════════════════════════════════════════════════════
   Chrome: progress, scroll hint, controls over the cover
   ══════════════════════════════════════════════════════════════════════ */

function setupChrome() {
  const progress = document.querySelector<HTMLElement>('.progress');
  const hint = document.getElementById('scroll-hint');
  const controls = document.getElementById('controls');
  const landing = document.getElementById('tapa');
  let hintDismissed = false;

  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    progress?.style.setProperty('--progress', String(ratio));

    if (hint) {
      // It has done its job the moment the reader scrolls; near the end it
      // would be pointing at nothing.
      if (!hintDismissed && window.scrollY > window.innerHeight * 0.35) {
        hint.classList.add('is-hidden');
        hintDismissed = true;
      } else if (hintDismissed && window.scrollY < window.innerHeight * 0.12) {
        hint.classList.remove('is-hidden');
        hintDismissed = false;
      }
    }

    if (landing && controls) {
      const overCover = landing.getBoundingClientRect().bottom > 76;
      controls.classList.toggle('is-over-cover', overCover);
      hint?.classList.toggle('is-over-cover', overCover);
    }
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      onScroll();
      updatePlates();
    });
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', () => {
    measurePlates();
    schedule();
  });
  onScroll();
}

/* ══════════════════════════════════════════════════════════════════════════
   Boot
   ══════════════════════════════════════════════════════════════════════ */

function boot() {
  // AVIF is served to everything that understands it; the WebP ladder is the
  // fallback, and the plate has to know which srcset to hand its layers.
  const probe = new Image();
  probe.onload = probe.onerror = () => {
    const supported = probe.width === 1;
    for (const plate of plates) plate.avifSupported = supported;
  };
  probe.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=';

  buildPlates();
  setupChrome();
  setupContents();
  wireModal('dlg-download', 'btn-download');
  setupZoom();
  setupMemory();
  updatePlates();

  // Late layout shifts — fonts settling, lazy images resolving — move every
  // heading, and the plate reads from cached offsets.
  document.fonts?.ready.then(() => {
    measurePlates();
    updatePlates();
  });
  window.addEventListener('load', () => {
    measurePlates();
    updatePlates();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

export {};
