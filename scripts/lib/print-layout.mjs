/**
 * The print layout pass: snaps every figure to the baseline grid and builds the
 * anchored photo block at the tail of a chronicle.
 *
 * `layoutInPage` runs inside Chrome, on a "simulated paged" copy of one block:
 * a multi-column container exactly one text box wide and one text box tall, so
 * its columns are the pages (Chrome fragments a column and a page with the same
 * engine, which is what makes the simulation faithful). From there it can read
 * where the text of the block ends, how many baselines are left under it, and
 * lay the figures out accordingly. It returns the block's markup with the
 * result baked in as plain elements and inline styles, so the real print needs
 * no script.
 *
 * The function is serialised by Playwright, so it must not reference anything
 * outside itself.
 *
 * Vocabulary: a unit is a figure or a figure module (a pair, the 2 × 2 grid);
 * a group is the units that share a page; the anchored group is the one that
 * rests on the foot of the page where the text ends.
 */

/**
 * @param {{ lhPx: number, boxLines: number, rescue: number, minLines: number }} opts
 */
export function layoutInPage(opts) {
  const { lhPx, boxLines, rescue, minLines } = opts;
  const cap = boxLines * lhPx;
  const EPS = 0.3;
  const sim = document.getElementById('sim');
  const simBox = sim.getBoundingClientRect();
  const colWidth = simBox.width;
  const root = sim.firstElementChild;
  const warnings = [];

  const frags = (el) => [...el.getClientRects()].filter((r) => r.width > 0 || r.height > 0);
  const colOf = (r) => Math.floor((r.left - simBox.left) / colWidth + 1e-3);
  const bottomOf = (r) => r.bottom - simBox.top;
  const pagesOf = (el) => {
    const f = frags(el);
    return f.length ? colOf(f.at(-1)) + 1 : 1;
  };

  // ── 0. The photo block gathers every figure of the block ──────────────────
  // An image never interrupts the reading: the ones the anchoring left inside
  // the running text travel to the end of the block, in document order, and
  // consecutive fichas pair into a row of two.
  let tail = root.querySelector('.tail-figures');
  const moved = [];
  const inline = [...root.querySelectorAll('figure.figure, .fig-module')].filter(
    (el) => !el.closest('.tail-figures') && !el.parentElement.closest('.fig-module'),
  );
  if (inline.length) {
    if (!tail) {
      tail = document.createElement('div');
      tail.className = 'tail-figures';
      root.append(tail);
    }
    for (const el of inline) {
      moved.push((el.id || el.querySelector('figure')?.id || '').replace('fig-', ''));
      tail.append(el);
    }
  }
  if (tail) {
    const kids = [...tail.children];
    for (let k = 0; k < kids.length - 1; k += 1) {
      const a = kids[k];
      const b = kids[k + 1];
      if (a.matches('figure.box-ficha') && b.matches('figure.box-ficha')) {
        const duo = document.createElement('div');
        duo.className = 'fig-module fig-duo';
        a.before(duo);
        a.classList.add('in-module');
        b.classList.add('in-module');
        duo.append(a, b);
        k += 1;
      }
    }
  }

  // ── 1. Figures: image + caption snapped to whole baselines ────────────────
  const figures = [...root.querySelectorAll('figure.figure')];
  /** Shrinks the image a little when the remainder is small, pads otherwise. */
  const SHRINK_MAX = (5 / 72) * 96; // five points
  const snapFigure = (fig) => {
    const img = fig.querySelector('img');
    fig.style.paddingBottom = '';
    img.style.height = '';
    for (let pass = 0; pass < 3; pass += 1) {
      const total = fig.getBoundingClientRect().height;
      const imgH = img.getBoundingClientRect().height;
      let rem = total % lhPx;
      if (total > cap + EPS) {
        img.style.height = `${imgH - (total - cap)}px`;
        continue;
      }
      if (rem < EPS || lhPx - rem < EPS) return;
      if (rem <= SHRINK_MAX && pass < 2) {
        img.style.height = `${imgH - rem}px`;
      } else {
        fig.style.paddingBottom = `${lhPx - rem}px`;
        return;
      }
    }
  };
  const snapAll = () => figures.forEach(snapFigure);
  snapAll();

  let units = tail ? [...tail.children] : [];
  // A module taller than the box (a long caption on a 2 × 2 grid) shrinks its
  // images until it holds.
  for (let guard = 0; guard < 8; guard += 1) {
    const over = units.filter((u) => u.getBoundingClientRect().height > cap + EPS);
    if (!over.length) break;
    for (const u of over) {
      for (const img of u.querySelectorAll('img')) {
        img.style.maxHeight = `${img.getBoundingClientRect().height * 0.94}px`;
      }
    }
    snapAll();
  }
  const lineMap = new Map();
  const measureUnit = (u) => {
    const h = u.getBoundingClientRect().height;
    const n = Math.round(h / lhPx);
    if (Math.abs(h - n * lhPx) > 1.2) warnings.push(`unit off grid by ${(h - n * lhPx).toFixed(2)}px`);
    lineMap.set(u, Math.max(1, n));
    return lineMap.get(u);
  };
  units.forEach(measureUnit);
  const linesOf = (u) => lineMap.get(u);

  /**
   * Two photographs that do not quite fit one page at full size share it
   * anyway when their images give up at most a quarter of their height.
   */
  const compress = (group) => {
    tail.style.display = '';
    const result = compressShown(group);
    tail.style.display = 'none';
    return result;
  };
  const compressShown = (group) => {
    const imgs = group.flatMap((u) => [...u.querySelectorAll('img')]);
    const before = imgs.map((img) => [img.style.maxHeight, img.getBoundingClientRect().height]);
    const total = group.reduce((a, u) => a + u.getBoundingClientRect().height, 0) + (group.length - 1) * lhPx;
    const imgSum = before.reduce((a, [, h]) => a + h, 0);
    let scale = (cap - (total - imgSum) - 2 * lhPx) / imgSum;
    for (let attempt = 0; attempt < 3 && scale >= 0.75; attempt += 1, scale *= 0.97) {
      imgs.forEach((img, i) => { img.style.maxHeight = `${before[i][1] * scale}px`; });
      snapAll();
      const lines = group.reduce((a, u) => a + measureUnit(u), 0) + group.length - 1;
      if (lines <= boxLines) return true;
    }
    imgs.forEach((img, i) => { img.style.maxHeight = before[i][0]; });
    snapAll();
    group.forEach(measureUnit);
    return false;
  };

  // ── 2. Where does the text end? ───────────────────────────────────────────
  // Rescue ladder for a stranded tail (see build-pdf.mjs): 1 asks for a longer
  // widow on the last two paragraphs; 2 keeps the last paragraph whole; 3 keeps
  // the last two whole. The leading and the tracking of the book never change.
  if (rescue) {
    const paragraphs = [...root.children].filter((e) => e.tagName === 'P');
    if (rescue === 1) paragraphs.slice(-2).forEach((p) => p.classList.add('rescue'));
    if (rescue === 2) paragraphs.slice(-1).forEach((p) => p.classList.add('rescue-keep'));
    if (rescue === 3) paragraphs.slice(-2).forEach((p) => p.classList.add('rescue-keep'));
  }
  if (tail) tail.style.display = 'none';
  const lastEl = tail ? tail.previousElementSibling : root.lastElementChild;
  const lastFrags = lastEl ? frags(lastEl) : [];
  const endFrag = lastFrags.at(-1);
  const textPages = endFrag ? colOf(endFrag) + 1 : pagesOf(root);
  const endLines = endFrag ? Math.ceil((bottomOf(endFrag) - EPS) / lhPx) : 0;
  const remaining = boxLines - endLines;

  // ── 3. Groups ─────────────────────────────────────────────────────────────
  const isPlano = (u) => u.matches('figure.box-plano');
  const isGrid = (u) => u.classList.contains('fig-grid2x2');
  const groups = [];
  let i = 0;
  const first = { units: [], lines: 0 };
  while (
    i < units.length &&
    !isPlano(units[i]) &&
    !isGrid(units[i]) &&
    // one baseline of air between the text and the figures
    1 + first.lines + (first.units.length ? 1 : 0) + linesOf(units[i]) <= remaining
  ) {
    first.lines += (first.units.length ? 1 : 0) + linesOf(units[i]);
    first.units.push(units[i]);
    i += 1;
  }
  if (first.units.length) groups.push({ ...first, anchored: true });

  let page = null;
  for (; i < units.length; i += 1) {
    const u = units[i];
    if (isPlano(u) || isGrid(u)) {
      page = null;
      groups.push({ units: [u], lines: linesOf(units[i]), plano: isPlano(u) });
      continue;
    }
    const plain = (x) => x.matches('figure.box-caja');
    if (page && page.lines + 1 + linesOf(units[i]) <= boxLines) {
      page.units.push(u);
      page.lines += 1 + linesOf(units[i]);
    } else if (page && plain(u) && page.units.every(plain) && compress([...page.units, u])) {
      page.units.push(u);
      page.lines = page.units.reduce((a, x) => a + linesOf(x), 0) + page.units.length - 1;
    } else {
      page = { units: [u], lines: linesOf(units[i]) };
      groups.push(page);
    }
  }

  // A lone small ficha on a page of its own looks lost: when the page before it
  // has two or more units, it takes the last of them across so the page holds a pair.
  const lastGroup = groups.at(-1);
  const prevGroup = groups.at(-2);
  if (
    lastGroup && prevGroup && !lastGroup.anchored && !prevGroup.anchored && !lastGroup.plano && !prevGroup.plano &&
    lastGroup.units.length === 1 && lastGroup.units[0].matches('figure.box-ficha') &&
    prevGroup.units.length > 1 && !isGrid(prevGroup.units[0])
  ) {
    const moved = prevGroup.units.pop();
    const movedLines = linesOf(moved);
    if (movedLines + 1 + lastGroup.lines <= boxLines) {
      lastGroup.units.unshift(moved);
      lastGroup.lines += 1 + movedLines;
    } else {
      prevGroup.units.push(moved);
    }
  }

  // ── 4. Build the markup, with a recto for every plano ─────────────────────
  if (tail) {
    tail.style.display = '';
    tail.textContent = '';
  }
  let pageCount = textPages;
  const blankIndex = [];
  for (const g of groups) {
    if (g.plano && pageCount % 2 === 1) {
      const blank = document.createElement('div');
      blank.className = 'tail-group is-blank is-next-page';
      blank.setAttribute('aria-hidden', 'true');
      tail.append(blank);
      blankIndex.push(pageCount);
      pageCount += 1;
    }
    const el = document.createElement('div');
    el.className = `tail-group${g.anchored ? ' is-anchored' : ' is-next-page'}`;
    if (g.anchored) {
      // Rests on the foot of the box; a hair short so rounding never pushes it.
      el.style.paddingTop = `${(remaining - g.lines) * lhPx - 0.25}px`;
    } else {
      pageCount += 1;
    }
    for (const u of g.units) el.append(u);
    tail.append(el);
  }

  // ── 5. Read the result back ───────────────────────────────────────────────
  const pages = pagesOf(root);
  const headingCols = {};
  for (const el of [root, ...root.querySelectorAll('[id]')]) {
    const f = frags(el)[0];
    if (el.id && f && !(el.id in headingCols)) headingCols[el.id] = colOf(f);
  }
  const blankCols = [...root.querySelectorAll('.tail-group.is-blank')].map((el) => colOf(frags(el)[0]));
  if (pages !== pageCount) warnings.push(`expected ${pageCount} pages, simulated ${pages}`);

  const debug = groups.map((g) => `${g.anchored ? 'A' : 'N'}${g.lines}[${g.units.map((u) => `${u.className.slice(0, 20)}:${u.getBoundingClientRect().height.toFixed(0)}`).join(',')}]`);
  return {
    debug,
    html: root.outerHTML,
    pages,
    expected: pageCount,
    textPages,
    endLines,
    anchored: groups.some((g) => g.anchored),
    shortTail: textPages > 1 && endLines > 0 && endLines < minLines && !groups.some((g) => g.anchored),
    headingCols,
    blankCols,
    blankIndex,
    moved,
    warnings,
  };
}
