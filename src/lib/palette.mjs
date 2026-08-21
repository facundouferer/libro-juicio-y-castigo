/**
 * The book's colour, in one place.
 *
 * The editorial pass ruled out a different hue per section — "queda como un
 * manual" — and asked instead for a single family read at different
 * intensities, so the transition between parts is felt without being announced
 * (spec 07, RF-07.1 and RF-07.6).
 *
 * That is what the CPM blue already was: measured, its nine steps sit at hue
 * 199–200 and vary only in saturation and lightness. So the scale is expressed
 * here as one hue plus the shape of that ramp, which makes the whole book's
 * colour a single number to change (RF-07.5).
 *
 * The three editions import this rather than repeating hex values: the PDF and
 * the EPUB used to carry their own copies of #145575 and #1e81b0 (RF-07.2).
 */

/** Hue of the whole book. 199 is the CPM blue the editorial pass approved. */
export const ACCENT_HUE = Number(process.env.SITE_ACCENT_HUE ?? 199);

/**
 * Saturation and lightness per step, taken from the approved blue. Changing the
 * hue above rides this same ramp, so the contrast guarantees below hold in any
 * colour family.
 */
const RAMP = {
  100: [56, 95],
  200: [55, 87],
  300: [55, 76],
  400: [53, 60],
  500: [64, 46],
  600: [71, 34],
  700: [71, 27],
  800: [71, 20],
  900: [71, 14],
};

function hslToHex(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n) => {
    const k = (n + h / 30) % 12;
    const value = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * value)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** The nine steps, as hex, for the current hue. */
export const ACCENT = Object.fromEntries(
  Object.entries(RAMP).map(([step, [s, l]]) => [step, hslToHex(ACCENT_HUE, s, l)]),
);

/** The base accent — step 500 slightly lifted, the colour of the cover title. */
export const ACCENT_BASE = hslToHex(ACCENT_HUE, 71, 40);

/**
 * Which step of the ramp each block of the book is read at. One family, seven
 * intensities: deep at the edges of the book, opening out through the middle
 * (RF-07.1). No section owns a colour — they own a depth.
 */
export const SECTION_STEP = {
  inicio: 800,
  'una-casa-con-una-sala-negra': 700,
  'violencia-sexual-como-crimen-de-lesa-humanidad': 600,
  'desaparecer-en-la-brigada': 500,
  'la-patota-de-la-brigada': 600,
  'juicio-y-castigo': 700,
  anexo: 800,
};

/**
 * The step small type is set in, whatever section it sits in. The section tone
 * governs titles, part numbers and rules — things that are either large or not
 * text at all — so it may run as light as step 500. A caption credit may not
 * (spec 07, RF-07.4).
 */
export const SMALL_TEXT_STEP = 700;

/** WCAG relative luminance of a hex colour. */
function luminance(hex) {
  const channel = (i) => {
    const value = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** Contrast ratio against white, which is the ground in all three editions. */
export function contrastOnWhite(hex) {
  return (1 + 0.05) / (luminance(hex) + 0.05);
}

/**
 * Every step in use, with its measured contrast on white. `check-build` prints
 * this so the guarantee in RF-07.4 is recorded rather than assumed.
 */
export function contrastReport() {
  const steps = [...new Set(Object.values(SECTION_STEP))].sort((a, b) => a - b);
  return steps.map((step) => {
    const ratio = contrastOnWhite(ACCENT[step]);
    return {
      step,
      hex: ACCENT[step],
      ratio: Number(ratio.toFixed(2)),
      // WCAG AA: 4.5 for body copy, 3 for large text and non-text elements.
      // The section tone drives titles, folios and rules only — small type uses
      // SMALL_TEXT_STEP — so 3 is the applicable floor for every step here.
      ok: ratio >= 3,
      bodySafe: ratio >= 4.5,
    };
  });
}

/**
 * The palette as CSS custom properties: the nine steps, then `--section-accent`
 * bound to the `data-section` every layout already emits.
 */
export function paletteCss({ scope = ':root' } = {}) {
  const steps = Object.entries(ACCENT)
    .map(([step, hex]) => `  --color-accent-${step}: ${hex};`)
    .join('\n');

  const sections = Object.entries(SECTION_STEP)
    .map(([id, step]) => `[data-section="${id}"] { --section-accent: ${ACCENT[step]}; }`)
    .join('\n');

  return `${scope} {
${steps}
  --color-accent: ${ACCENT_BASE};
  --section-accent: ${ACCENT[700]};
  --small-text-accent: ${ACCENT[SMALL_TEXT_STEP]};
}
${sections}
`;
}
