/**
 * Turns the manuscript's two-heading chronicle opening into one header block.
 *
 * Before:
 *     <h1 id="causa-brigada-i-7-julio-2010">CAUSA BRIGADA I 7 julio 2010</h1>
 *     <h2 id="la-tortura-en-el-chaco…">“LA TORTURA EN EL CHACO…”</h2>
 *
 * After:
 *     <header class="cronica-head">
 *       <p class="cronica-volanta" id="causa-brigada-i-7-julio-2010">CAUSA BRIGADA I 7 julio 2010</p>
 *       <h2 class="cronica-title" id="la-tortura-en-el-chaco…">“LA TORTURA EN EL CHACO…”</h2>
 *     </header>
 *
 * Two things change and one does not.
 *
 * The volanta stops being a heading (spec 04, RF-04.5): the PDF outline, the
 * EPUB navigation and the site's contents panel listed 34 entries reading
 * «CAUSA BRIGADA I …», which is not what anybody navigates by. Now they list
 * the headlines.
 *
 * The headline stops taking its size from its level and takes it from its role,
 * so the volanta can never outweigh it again (RF-04.4).
 *
 * What does not change is the anchor id of either one (RF-04.6). The image map
 * keys on those ids; renaming one would orphan every photograph anchored to it.
 *
 * Runs *after* the image-anchoring plugin, which needs the plain heading tree.
 */

import { visit } from 'unist-util-visit';
import { isVolanta } from './cronicas.mjs';

const el = (tagName, properties, children) => ({ type: 'element', tagName, properties, children });

/** Flattens a heading's hast children back to plain text. */
function textOf(node) {
  let out = '';
  visit(node, 'text', (child) => {
    out += child.value;
  });
  return out.trim();
}

export function rehypeCronicaHeads() {
  return (tree) => {
    const found = [];

    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'h1' || !parent || index === null) return;
      const id = node.properties?.id;
      if (!isVolanta(1, textOf(node), id)) return;
      found.push({ parent, index, node });
    });

    // Backwards, so the indices recorded above stay valid as siblings are
    // replaced by a single node.
    for (const { parent, index, node } of found.reverse()) {
      const siblings = parent.children;

      const volanta = el(
        'p',
        { className: ['cronica-volanta'], ...(node.properties?.id ? { id: node.properties.id } : {}) },
        node.children,
      );

      const children = [volanta];
      let consumed = 1;

      // remark-rehype leaves the newlines between blocks in the tree, so the
      // next *element* is one or two nodes further along than the next child.
      let after = index + 1;
      while (siblings[after]?.type === 'text' && !siblings[after].value.trim()) after += 1;

      // The headline is the `h2` immediately after the volanta. When body text
      // comes between them — «Las condenas» opens that way — the volanta stands
      // alone and that later `h2` stays an ordinary subtitle (RF-04.3).
      const next = siblings[after];
      if (next?.type === 'element' && next.tagName === 'h2') {
        children.push(
          el('h2', { ...next.properties, className: ['cronica-title'] }, next.children),
        );
        consumed = after + 1 - index;
      }

      siblings.splice(index, consumed, el('header', { className: ['cronica-head'] }, children));
    }
  };
}

export default rehypeCronicaHeads;
