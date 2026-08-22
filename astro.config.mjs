// @ts-check
import { defineConfig } from 'astro/config';
import { rehypeAnchorImages } from './src/lib/rehype-anchor-images.mjs';
import { rehypeCronicaHeads } from './src/lib/rehype-cronica-heads.mjs';

/**
 * GitHub Pages serves a project site from /<repo>/, so both `site` and `base`
 * have to match the repository or every asset URL breaks. The workflow sets
 * them from the repository itself; the defaults here are what `astro dev` uses.
 *
 * For a user/organisation site (`<user>.github.io`) set SITE_BASE to `/`.
 */
const site = process.env.SITE_URL ?? 'https://cpmchaco.github.io';
const base = process.env.SITE_BASE ?? '/juicio-y-castigo-chaco';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  output: 'static',
  build: {
    // The book is one long document; inlining its stylesheet saves the extra
    // round trip before first paint on the landing.
    inlineStylesheets: 'auto',
    format: 'directory',
  },
  image: {
    // Every derivative is pre-built and committed under public/img by
    // scripts/optimize-images.mjs, so Astro must not re-process anything —
    // 105 archival scans would blow the CI budget on every deploy.
    service: { entrypoint: 'astro/assets/services/noop' },
  },
  markdown: {
    smartypants: false,
    shikiConfig: { theme: 'github-light' },
    // Runs after Astro's own heading-slug pass, so every heading already has
    // the id the image map targets.
    rehypePlugins: [rehypeAnchorImages, rehypeCronicaHeads],
  },
  devToolbar: { enabled: false },
});
