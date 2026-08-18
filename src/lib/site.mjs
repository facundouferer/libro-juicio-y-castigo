/**
 * Shared build-time configuration.
 *
 * astro.config.mjs and the rehype plugin both need the deploy base path, and
 * the plugin runs as plain Node with no access to Astro's runtime env — so the
 * value is resolved here once and imported by both.
 */

export const SITE_URL = process.env.SITE_URL ?? 'https://cpmchaco.github.io';

/** Always exactly one leading slash and no trailing one, or empty at the root. */
export const BASE = (() => {
  const raw = process.env.SITE_BASE ?? '/juicio-y-castigo-chaco';
  const trimmed = raw.replace(/\/+$/, '');
  if (!trimmed || trimmed === '/') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
})();

/** Prefixes an absolute site path with the deploy base. */
export function withBase(pathname) {
  return `${BASE}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

export const BOOK = {
  title: 'Juicio y Castigo en el Chaco',
  volume: 'Vol II',
  subtitle: 'Causa Brigada I, II, III',
  kicker: 'Crónicas, dibujos y fotografías',
  publisher: 'Comisión Provincial por la Memoria — Chaco',
  description:
    'Crónicas de los tres juicios por crímenes de lesa humanidad cometidos en el centro clandestino de detención de la Brigada de Investigaciones de la Policía del Chaco.',
};
