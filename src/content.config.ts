import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * The book, as one ordered sequence of documents.
 *
 * `order` is global and drives the single continuous scroll — the site is read
 * front to back like the printed edition, so nothing here is sorted by name or
 * by date. `pageType` selects which of the three layouts from the spec renders
 * the document.
 */
const book = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/book' }),
  schema: z.object({
    title: z.string(),
    /** Stable identity across the site, the image map and the PDF/EPUB builds. */
    docSlug: z.string(),
    order: z.number().int().nonnegative(),
    section: z.string(),
    pageType: z.enum(['landing', 'chapter-opening', 'reader', 'interlude', 'citations', 'colophon']),
    /** False for documents whose title is an internal label (spec 02, RF-02.3). */
    showTitle: z.boolean().default(true),
    /** Overline printed above the title, e.g. the institutional attribution. */
    kicker: z.string().optional(),
    /** Signature printed below the title and before the first paragraph. */
    byline: z.string().optional(),
    words: z.number().int().nonnegative(),
    sourceFile: z.string(),
  }),
});

export const collections = { book };
