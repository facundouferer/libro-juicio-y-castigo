/**
 * The 3D book (/libro).
 *
 * A hardcover lies on a wooden table. The camera finds its cover, the cover
 * opens on the first page of the PDF and the camera rises to a top view where
 * a spread reads at full size. A click on the right page turns it forward, a
 * click on the left page turns it back.
 *
 * Only two pages are ever drawn flat — the spread in view — plus the sheet that
 * is turning. The stacks under them are boxes whose height follows the reading
 * position, so 314 pages cost two textures and a few draw calls.
 *
 * Leaves: leaf 0 is the front cover (outside: the cover, inside: endpaper);
 * leaf i (1…N) carries PDF page 2i−1 on its front and 2i on its back. `turned`
 * counts the leaves lying on the left.
 */
import * as THREE from 'three';
import pages from '../data/libro-pages.json';

const root = document.getElementById('libro') as HTMLElement;
const canvas = document.getElementById('libro-canvas') as HTMLCanvasElement;
const base = document.documentElement.dataset.base ?? '';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const PAGE_COUNT: number = pages.count;
const LEAVES = Math.ceil(PAGE_COUNT / 2) + 1; // + the front cover
const W = 1; // page width, scene units
const H = W / pages.aspect; // page height
const BLOCK = 0.09; // thickness of the whole text block
const BOARD = 0.012; // thickness of a cover board
const OVERHANG = 0.014; // boards stand proud of the pages
const SEGMENTS = 40; // along the width of a turning sheet
const ENDPAPER = '#e9e2d3';
const PAPER_EDGE = '#efe8da';

const accent = root.dataset.accent ?? '#1e80ae';

// ── Renderer, scene, camera ──────────────────────────────────────────────────

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch {
  root.classList.add('no-webgl');
  throw new Error('WebGL no disponible');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1b1410');
scene.fog = new THREE.Fog('#1b1410', 6, 14);

const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);

scene.add(new THREE.HemisphereLight('#fff4e0', '#3a2a1c', 1.15));
const sun = new THREE.DirectionalLight('#fff1dc', 2.1);
sun.position.set(-1.6, 4.2, 1.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -2.5;
sun.shadow.camera.right = 2.5;
sun.shadow.camera.top = 2.5;
sun.shadow.camera.bottom = -2.5;
sun.shadow.bias = -0.0004;
sun.shadow.radius = 4;
scene.add(sun);

// ── The table: procedural wood, no download ─────────────────────────────────

function woodTexture(): THREE.CanvasTexture {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  // Cheap 1D value noise, enough to wobble the grain.
  const rnd = Array.from({ length: 512 }, () => Math.random());
  const noise = (t: number) => {
    const i = Math.floor(t);
    const f = t - i;
    const a = rnd[i & 511];
    const b = rnd[(i + 1) & 511];
    return a + (b - a) * f * f * (3 - 2 * f);
  };
  const planks = 5;
  const plankH = size / planks;
  // Fine streaks run the length of the plank: noise in y only, stretched in x.
  const streak = Array.from({ length: size }, (_, y) => noise(y * 0.9) * 0.6 + noise(y * 0.23) * 0.4);
  for (let y = 0; y < size; y += 1) {
    const plank = Math.floor(y / plankH);
    const local = y % plankH;
    const shade = 0.82 + rnd[plank * 7] * 0.28;
    const offset = rnd[plank * 13] * 400;
    for (let x = 0; x < size; x += 1) {
      // Growth rings: wide, low-contrast bands, bent by slow noise.
      const warp = noise((x + offset) / 160) * 26 + noise((x + offset) / 45) * 5;
      const ring = 0.5 + 0.5 * Math.sin((local + warp) * 0.11 + plank * 2.1);
      const fine = (streak[(y + Math.floor(noise((x + offset) / 300) * 6)) % size] - 0.5) * 0.12;
      let v = (0.7 + ring * 0.14 + fine) * shade;
      if (local < 2 || local > plankH - 2) v *= 0.5; // seam between planks
      const k = (y * size + x) * 4;
      img.data[k] = 148 * v + 20;
      img.data[k + 1] = 92 * v + 12;
      img.data[k + 2] = 54 * v + 8;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.6, 1.6);
  tex.anisotropy = maxAniso;
  return tex;
}

const table = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 14),
  new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.62, metalness: 0 }),
);
table.rotation.x = -Math.PI / 2;
table.rotation.z = Math.PI / 2; // grain runs across the book
table.receiveShadow = true;
scene.add(table);

// ── The cover, drawn from the site's own cover ──────────────────────────────

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

async function coverTexture(): Promise<THREE.CanvasTexture> {
  const cw = 1200;
  const ch = Math.round(cw / pages.aspect);
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d')!;
  const [photo, logo] = await Promise.all([
    loadImage(root.dataset.cover!),
    loadImage(root.dataset.logo!).catch(() => null),
    document.fonts.load('700 80px Oswald'),
    document.fonts.load('600 40px Oswald'),
    document.fonts.load('italic 600 30px "Source Sans 3 Variable"'),
  ]);

  // The photograph, cropped to fill the board like `object-fit: cover`.
  const s = Math.max(cw / photo.width, ch / photo.height);
  const pw = photo.width * s;
  const ph = photo.height * s;
  ctx.drawImage(photo, (cw - pw) / 2, (ch - ph) / 2, pw, ph);

  // The same veil as the landing (book.css, .landing::before).
  const veil = ctx.createLinearGradient(0, 0, cw, ch * 0.3);
  veil.addColorStop(0, 'rgba(38,41,44,0.88)');
  veil.addColorStop(0.45, 'rgba(38,41,44,0.74)');
  veil.addColorStop(1, 'rgba(38,41,44,0.64)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, cw, ch);

  const pad = cw * 0.09;
  let y = ch * 0.2;
  if (logo) {
    const lw = cw * 0.3;
    const lh = (logo.height / logo.width) * lw;
    ctx.drawImage(logo, pad, y, lw, lh);
    y += lh + ch * 0.05;
  }

  // Title lines on the house band (cpm.css, .hl).
  const band = (text: string, size: number) => {
    ctx.font = `700 ${size}px Oswald`;
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(text);
    const bx = size * 0.28;
    ctx.fillStyle = accent;
    ctx.fillRect(pad - bx, y - size * 0.98, m.width + 2 * bx, size * 1.22);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, pad, y);
    y += size * 1.42;
  };
  const words = (root.dataset.title ?? '').toUpperCase().split(' ');
  // Two balanced lines, like `text-wrap: balance` on the landing.
  const cut = Math.ceil(words.length / 2);
  const titleSize = cw * 0.082;
  y += titleSize;
  band(words.slice(0, cut).join(' '), titleSize);
  band(words.slice(cut).join(' '), titleSize);
  band((root.dataset.volume ?? '').toUpperCase(), titleSize);

  y += ch * 0.025;
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${cw * 0.05}px Oswald`;
  ctx.fillText((root.dataset.subtitle ?? '').toUpperCase(), pad, y);
  y += cw * 0.055;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `italic 600 ${cw * 0.026}px "Source Sans 3 Variable", sans-serif`;
  ctx.fillText(root.dataset.kicker ?? '', pad, y);

  // The author, at the foot, with the publisher under it.
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${cw * 0.046}px Oswald`;
  ctx.fillText((root.dataset.author ?? '').toUpperCase(), pad, ch - pad * 1.55);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = `600 ${cw * 0.022}px "Source Sans 3 Variable", sans-serif`;
  ctx.fillText(root.dataset.publisher ?? '', pad, ch - pad * 1.05);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

// ── Page textures, loaded around the reading position ───────────────────────

const loader = new THREE.TextureLoader();
const cache = new Map<number, Promise<THREE.Texture>>();
const pageUrl = (n: number) => `${base}/img/libro/${pages.files[n - 1]}`;

function pageTexture(n: number): Promise<THREE.Texture> {
  let t = cache.get(n);
  if (!t) {
    t = loader.loadAsync(pageUrl(n)).then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      return tex;
    });
    cache.set(n, t);
  }
  return t;
}

/** Keeps a few spreads either side warm and frees the rest. */
function prefetch(turned: number) {
  const first = Math.max(1, 2 * (turned - 3) - 1);
  const last = Math.min(PAGE_COUNT, 2 * (turned + 3));
  for (let n = first; n <= last; n += 1) pageTexture(n);
  for (const [n, t] of cache) {
    if (n < first - 4 || n > last + 4) {
      t.then((tex) => {
        tex.dispose();
        mirrors.get(tex)?.dispose();
        mirrors.delete(tex);
      });
      cache.delete(n);
    }
  }
}

/** What a face shows: a PDF page, the cover, or endpaper. */
type Face = { page: number } | { cover: true } | { endpaper: true };
const frontOf = (leaf: number): Face => (leaf === 0 ? { cover: true } : leaf < LEAVES && 2 * leaf - 1 <= PAGE_COUNT ? { page: 2 * leaf - 1 } : { endpaper: true });
const backOf = (leaf: number): Face => (leaf === 0 ? { endpaper: true } : 2 * leaf <= PAGE_COUNT ? { page: 2 * leaf } : { endpaper: true });

let coverTex: THREE.Texture | null = null;

/** Paints a face onto a material; a back face is mirrored so it reads from above. */
function paint(mat: THREE.MeshStandardMaterial, face: Face, mirrored: boolean) {
  const token = Symbol();
  (mat.userData as { token?: symbol }).token = token;
  const apply = (tex: THREE.Texture | null, color: string) => {
    if ((mat.userData as { token?: symbol }).token !== token) return; // a later paint won
    if (tex) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.x = mirrored ? -1 : 1;
      tex.offset.x = mirrored ? 1 : 0;
    }
    mat.map = tex;
    mat.color.set(color);
    mat.needsUpdate = true;
  };
  if ('cover' in face) apply(coverTex, '#ffffff');
  else if ('endpaper' in face) apply(null, ENDPAPER);
  else {
    apply(null, '#ffffff'); // blank paper until the image arrives
    pageTexture(face.page).then((tex) => {
      // One texture may sit on a front and a back at once: clone for the mirror.
      apply(mirrored ? cloneMirrored(tex) : tex, '#ffffff');
    });
  }
}
const mirrors = new WeakMap<THREE.Texture, THREE.Texture>();
function cloneMirrored(tex: THREE.Texture): THREE.Texture {
  let m = mirrors.get(tex);
  if (!m) {
    m = tex.clone();
    m.needsUpdate = true;
    mirrors.set(tex, m);
  }
  return m;
}

// ── Geometry ────────────────────────────────────────────────────────────────

/** A sheet hinged on the spine (x = 0), width along +x, height along z. */
function sheetGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((SEGMENTS + 1) * 2 * 3);
  const uv = new Float32Array((SEGMENTS + 1) * 2 * 2);
  const index: number[] = [];
  for (let i = 0; i <= SEGMENTS; i += 1) {
    const u = i / SEGMENTS;
    // row 0: top of the page (−z), row 1: foot (+z)
    uv.set([u, 1, u, 0], i * 4);
    if (i < SEGMENTS) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      index.push(a, b, c, c, b, d);
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/**
 * Lays the sheet out for a turn angle θ (0 = flat on the right, π = flat on the
 * left). The free edge lags the spine, so the sheet curls as it travels.
 */
function bendSheet(g: THREE.BufferGeometry, theta: number, lift: number, curl: number) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const step = W / SEGMENTS;
  let x = 0;
  let y = lift;
  for (let i = 0; i <= SEGMENTS; i += 1) {
    pos.setXYZ(i * 2, x, y, -H / 2);
    pos.setXYZ(i * 2 + 1, x, y, H / 2);
    const u = (i + 0.5) / SEGMENTS;
    const phi = theta + curl * Math.sin(theta) * u * u;
    x += Math.cos(phi) * step;
    y += Math.sin(phi) * step;
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

// Not tone-mapped: the page has to read as white paper, not as grey.
const paperMat = () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0, toneMapped: false });

function makeSheet() {
  const geometry = sheetGeometry();
  const front = paperMat();
  const back = paperMat();
  back.side = THREE.BackSide;
  const group = new THREE.Group();
  const f = new THREE.Mesh(geometry, front);
  const b = new THREE.Mesh(geometry, back);
  f.castShadow = b.castShadow = true;
  f.receiveShadow = true;
  group.add(f, b);
  return { group, geometry, front, back, frontMesh: f };
}

const book = new THREE.Group();
scene.add(book);

const edgeMat = new THREE.MeshStandardMaterial({ color: PAPER_EDGE, roughness: 0.95 });
const boardMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55 });

const box = (mat: THREE.Material) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  m.castShadow = m.receiveShadow = true;
  book.add(m);
  return m;
};
const backBoard = box(boardMat);
const frontBoard = box(boardMat); // under the left stack once the cover is open
const rightBlock = box(edgeMat);
const leftBlock = box(edgeMat);
const spine = box(boardMat);

/** The two pages lying flat — the spread being read. */
const right = makeSheet();
const left = makeSheet();
const turning = makeSheet();
book.add(right.group, left.group, turning.group);
bendSheet(right.geometry, 0, 0, 0);
bendSheet(left.geometry, Math.PI, 0, 0);
turning.group.visible = false;

const blockOf = (leaves: number) => (Math.max(0, leaves) / (LEAVES - 1)) * BLOCK;

function placeBlocks(leftLeaves: number, rightLeaves: number, coverOpen: boolean) {
  const hl = blockOf(leftLeaves);
  const hr = blockOf(rightLeaves);
  const bw = W + OVERHANG;
  const bh = H + 2 * OVERHANG;
  backBoard.scale.set(bw, BOARD, bh);
  backBoard.position.set(bw / 2, BOARD / 2, 0);
  frontBoard.visible = coverOpen;
  frontBoard.scale.set(bw, BOARD, bh);
  frontBoard.position.set(-bw / 2, BOARD / 2, 0);
  rightBlock.visible = hr > 0.0005;
  rightBlock.scale.set(W, Math.max(hr, 0.0005), H);
  rightBlock.position.set(W / 2, BOARD + hr / 2, 0);
  leftBlock.visible = hl > 0.0005;
  leftBlock.scale.set(W, Math.max(hl, 0.0005), H);
  leftBlock.position.set(-W / 2, BOARD + hl / 2, 0);
  const sh = BOARD * 2 + BLOCK;
  spine.scale.set(0.02, coverOpen ? BOARD * 1.4 : sh, bh);
  spine.position.set(-0.01, coverOpen ? BOARD * 0.7 : sh / 2, 0);
  return { hl, hr };
}

// ── State ───────────────────────────────────────────────────────────────────

let turned = 0; // leaves on the left; 0 = closed
let busy = false;
let opened = false;

const pageLabel = document.getElementById('libro-page')!;

/** Paper leaves in each stack, the visible pages included. */
const leftLeaves = () => Math.max(turned - 1, 0);
const rightLeaves = () => LEAVES - 1 - leftLeaves();

function layout() {
  const coverOpen = turned > 0;
  const { hl, hr } = placeBlocks(leftLeaves(), rightLeaves(), coverOpen);
  // Closed: the cover lies on top of the whole block.
  right.group.position.y = coverOpen ? BOARD + hr + 0.001 : BOARD * 2 + BLOCK + 0.001;
  left.group.position.y = BOARD + hl + 0.001;
  left.group.visible = coverOpen;
  paint(right.front, frontOf(turned), false);
  if (coverOpen) paint(left.back, backOf(turned - 1), true);
  prefetch(turned);
  updateLabel();
}

function updateLabel() {
  const shown = [turned > 0 ? backOf(turned - 1) : null, frontOf(turned)]
    .filter((f): f is { page: number } => !!f && 'page' in f)
    .map((f) => f.page);
  pageLabel.textContent =
    turned === 0 ? 'Tapa' : shown.length === 2 ? `págs. ${shown[0]}–${shown[1]} de ${PAGE_COUNT}` : shown.length ? `pág. ${shown[0]} de ${PAGE_COUNT}` : 'Contratapa';
  (document.getElementById('libro-prev') as HTMLButtonElement).disabled = turned <= 1;
  (document.getElementById('libro-next') as HTMLButtonElement).disabled = turned >= LEAVES;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function tween(ms: number, step: (k: number) => void): Promise<void> {
  if (reduceMotion) ms = Math.min(ms, 1);
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      step(ease(k));
      if (k < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

/** Turns one leaf: forward (right → left) or back (left → right). */
async function turn(dir: 1 | -1, ms = 900) {
  if (busy) return;
  const leaf = dir === 1 ? turned : turned - 1;
  if (leaf < 0 || leaf >= LEAVES || (dir === -1 && turned <= 1)) return;
  busy = true;

  paint(turning.front, frontOf(leaf), false);
  paint(turning.back, backOf(leaf), true);
  const startY = right.group.position.y;
  const fromLeft = left.group.position.y;

  // The page under the turning leaf is uncovered at once.
  if (dir === 1) {
    turned += 1;
    const keepLeft = turned - 2;
    if (keepLeft >= 0) paint(left.back, backOf(keepLeft), true);
    left.group.visible = keepLeft >= 0;
    paint(right.front, frontOf(turned), false);
    // While the cover turns, the board travelling is the cover itself.
    placeBlocks(turned - 2, LEAVES - turned, leaf > 0);
    right.group.position.y = BOARD + blockOf(LEAVES - turned) + 0.001;
  } else {
    turned -= 1;
    paint(left.back, backOf(turned - 1), true);
    left.group.visible = turned > 0;
    left.group.position.y = BOARD + blockOf(turned - 1) + 0.001;
    placeBlocks(turned - 1, LEAVES - 1 - turned, turned > 0);
  }
  updateLabel();

  turning.group.visible = true;
  const y0 = dir === 1 ? startY : fromLeft;
  const y1 = dir === 1 ? BOARD + blockOf(turned - 1) + 0.002 : BOARD + blockOf(LEAVES - 1 - turned) + 0.002;
  const isCover = leaf === 0;
  await tween(isCover ? ms * 1.6 : ms, (k) => {
    const theta = dir === 1 ? k * Math.PI : (1 - k) * Math.PI;
    const curl = isCover ? 0 : dir === 1 ? -0.9 : 0.9;
    bendSheet(turning.geometry, theta, 0, curl);
    turning.group.position.y = y0 + (y1 - y0) * k;
  });
  turning.group.visible = false;
  busy = false;
  layout();
}

// ── Camera ──────────────────────────────────────────────────────────────────

const look = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

/** Distance at which a w × h rectangle fills the view with a margin. */
function fit(w: number, h: number) {
  const v = THREE.MathUtils.degToRad(camera.fov) / 2;
  return Math.max((h * 1.12) / 2 / Math.tan(v), (w * 1.08) / 2 / (Math.tan(v) * camera.aspect));
}

const portrait = () => camera.aspect < 0.9;
let focusSide: -1 | 1 = 1; // in portrait one page fills the view

// Wheel zoom: < 1 brings the camera closer. `pan` shifts the top view on the
// table so the zoom goes towards the point under the cursor.
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.8;
let zoom = 1;
const pan = new THREE.Vector2(); // x, z

function topView() {
  const single = portrait();
  const d = fit(single ? W : 2 * W, H) * zoom;
  const cx = (single ? (focusSide * W) / 2 : 0) + pan.x;
  return {
    pos: new THREE.Vector3(cx, d + BLOCK, pan.y + 0.0001),
    target: new THREE.Vector3(cx, BLOCK / 2, pan.y),
    up: new THREE.Vector3(0, 0, -1),
  };
}
function coverView() {
  const d = fit(W, H) * 1.05;
  return {
    // The closed book is centred on the origin (book.position.x = −W/2).
    pos: new THREE.Vector3(0.35, d * 0.55, d * 0.75),
    target: new THREE.Vector3(0, BLOCK, 0.05),
    up: new THREE.Vector3(0, 1, 0),
  };
}
function farView() {
  const v = coverView();
  return { pos: v.pos.clone().multiplyScalar(2.1).add(new THREE.Vector3(1.2, 0.6, 0)), target: v.target, up: v.up };
}

type View = ReturnType<typeof topView>;
function setView(v: View) {
  camera.position.copy(v.pos);
  look.copy(v.target);
  up.copy(v.up);
}
/** Once the book is open the camera eases towards the top view every frame. */
let follow = false;

function moveCamera(to: View, ms: number) {
  // Past the opening, the follow loop does the easing (and keeps the zoom).
  if (follow) return Promise.resolve();
  const p0 = camera.position.clone();
  const t0 = look.clone();
  const u0 = up.clone();
  return tween(ms, (k) => {
    camera.position.lerpVectors(p0, to.pos, k);
    look.lerpVectors(t0, to.target, k);
    up.lerpVectors(u0, to.up, k).normalize();
  });
}

// ── Input ───────────────────────────────────────────────────────────────────

const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Clicks made during a turn are kept (a few), so quick clicks leaf through.
const queue: Array<() => Promise<unknown>> = [];
function enqueue(action: () => Promise<unknown>) {
  if (!opened) return;
  if (queue.length < 4) queue.push(action);
  if (queue.length === 1) drain();
}
async function drain() {
  while (queue.length) {
    await queue[0]();
    queue.shift();
  }
}

async function forward() {
  if (busy) return;
  if (portrait() && focusSide === -1) {
    focusSide = 1;
    return moveCamera(topView(), 450);
  }
  await turn(1);
  if (portrait()) {
    focusSide = -1;
    moveCamera(topView(), 450);
  }
}
async function backward() {
  if (busy) return;
  if (portrait() && focusSide === 1 && turned > 1) {
    focusSide = -1;
    return moveCamera(topView(), 450);
  }
  await turn(-1);
  if (portrait()) {
    focusSide = 1;
    moveCamera(topView(), 450);
  }
}

canvas.addEventListener('click', (e) => {
  if (!opened) return;
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hits = ray.intersectObjects([right.frontMesh, left.group.children[1], rightBlock, leftBlock], false);
  if (!hits.length) return;
  const x = hits[0].point.x - book.position.x;
  enqueue(x >= 0 ? forward : backward);
});
canvas.addEventListener('pointermove', (e) => {
  if (!opened) return;
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  canvas.style.cursor = ray.intersectObjects([right.frontMesh, left.group.children[1]], false).length ? 'pointer' : '';
});
// Zoom towards the point of the table under the cursor.
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BLOCK / 2);
const hit = new THREE.Vector3();
canvas.addEventListener(
  'wheel',
  (e) => {
    if (!opened) return;
    e.preventDefault();
    // Lines (Firefox) and pages are scaled to pixels so every device steps alike.
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    const next = THREE.MathUtils.clamp(zoom * Math.exp(dy * 0.0015), ZOOM_MIN, ZOOM_MAX);
    if (next === zoom) return;
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const v = topView();
    if (ray.ray.intersectPlane(tablePlane, hit)) {
      // Keep the point under the cursor where it is while the distance changes.
      const k = next / zoom;
      pan.x += (hit.x - v.target.x) * (1 - k);
      pan.y += (hit.z - v.target.z) * (1 - k);
    }
    zoom = next;
    // Back at the full view or beyond, the book returns to the centre.
    if (zoom >= 1) pan.multiplyScalar(Math.max(0, (ZOOM_MAX - zoom) / (ZOOM_MAX - 1)) * 0.5);
    pan.x = THREE.MathUtils.clamp(pan.x, -W, W);
    pan.y = THREE.MathUtils.clamp(pan.y, -H / 2, H / 2);
  },
  { passive: false },
);

document.getElementById('libro-next')!.addEventListener('click', () => enqueue(forward));
document.getElementById('libro-prev')!.addEventListener('click', () => enqueue(backward));
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault();
    enqueue(forward);
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault();
    enqueue(backward);
  } else if (e.key === '0') {
    zoom = 1;
    pan.set(0, 0);
  }
});

// ── Frame loop and resize ───────────────────────────────────────────────────

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
let lastAspect = 0;
new ResizeObserver(() => {
  resize();
  if (opened && !busy && Math.abs(camera.aspect - lastAspect) > 0.01) setView(topView());
  lastAspect = camera.aspect;
}).observe(canvas);
resize();

if (import.meta.env.DEV) Object.assign(window, { __libro: { camera, scene, renderer, book, look } });

renderer.setAnimationLoop(() => {
  if (follow) {
    const v = topView();
    const k = reduceMotion ? 1 : 0.16;
    camera.position.lerp(v.pos, k);
    look.lerp(v.target, k);
    up.copy(v.up);
  }
  camera.up.copy(up);
  camera.lookAt(look);
  renderer.render(scene, camera);
});

// ── The opening sequence ────────────────────────────────────────────────────

// Closed, the book sits centred on its cover; open, on its spine.
book.position.x = -W / 2;
layout();
setView(farView());

coverTexture()
  .then((tex) => {
    coverTex = tex;
    layout();
  })
  .catch(() => layout())
  .finally(async () => {
    root.classList.add('is-ready');
    pageTexture(1);
    // The camera finds the cover…
    await moveCamera(coverView(), 2200);
    await new Promise((r) => setTimeout(r, reduceMotion ? 0 : 700));
    // …the cover opens on page 1 while the book slides to its spine…
    const slide = tween(1500, (k) => {
      book.position.x = -W / 2 + (W / 2) * k;
    });
    const rise = moveCamera(topView(), 1900);
    await turn(1, 1000);
    await Promise.all([slide, rise]);
    opened = true;
    follow = true;
    lastAspect = camera.aspect;
    root.classList.add('is-open');
  });
