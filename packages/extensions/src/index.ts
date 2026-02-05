/**
 * @writerkit/extensions
 *
 * Rich content extensions for WriterKit editor.
 * Provides support for tables, images, lists, headers/footers,
 * and other complex document elements beyond basic text.
 *
 * @packageDocumentation
 */

import { Extension } from '@writerkit/core'

/**
 * Tables extension for WriterKit.
 * Provides table creation, editing, and formatting capabilities.
 *
 * @remarks
 * This extension is not yet implemented. It will include:
 * - Table node with rows and cells
 * - Cell merging and splitting
 * - Column/row resizing
 * - Table styling and borders
 * - Page-aware table splitting
 */
export const Tables = Extension.create({
  name: 'tables',

  addNodes() {
    return {
      table: {
        group: 'block',
        content: 'tableRow+',
        tableRole: 'table',
        parseDOM: [{ tag: 'table' }],
        toDOM() {
          return ['table', 0]
        },
      },
      tableRow: {
        content: 'tableCell+',
        tableRole: 'row',
        parseDOM: [{ tag: 'tr' }],
        toDOM() {
          return ['tr', 0]
        },
      },
      tableCell: {
        content: 'block+',
        tableRole: 'cell',
        attrs: {
          colspan: { default: 1 },
          rowspan: { default: 1 },
        },
        parseDOM: [{ tag: 'td' }],
        toDOM() {
          return ['td', 0]
        },
      },
    }
  },
})

/**
 * Images extension for WriterKit.
 * Handles image insertion, positioning, and formatting.
 *
 * @remarks
 * This extension is not yet implemented. It will include:
 * - Image node with src, alt, title
 * - Image resizing and alignment
 * - Inline and block image modes
 * - Image captions
 */
export const Images = Extension.create({
  name: 'images',

  addNodes() {
    return {
      image: {
        group: 'block',
        attrs: {
          src: {},
          alt: { default: null },
          title: { default: null },
          width: { default: null },
          height: { default: null },
        },
        parseDOM: [
          {
            tag: 'img[src]',
            getAttrs(dom) {
              const el = dom as HTMLElement
              return {
                src: el.getAttribute('src'),
                alt: el.getAttribute('alt'),
                title: el.getAttribute('title'),
                width: el.getAttribute('width'),
                height: el.getAttribute('height'),
              }
            },
          },
        ],
        toDOM(node) {
          return ['img', node.attrs]
        },
      },
    }
  },
})

/**
 * Lists extension for WriterKit.
 * Provides ordered, unordered, and nested list support.
 *
 * @remarks
 * This extension is not yet implemented. It will include:
 * - Bullet lists with custom markers
 * - Numbered lists with various formats
 * - Multi-level nested lists
 * - List continuation across pages
 */
export const Lists = Extension.create({
  name: 'lists',

  addNodes() {
    return {
      bulletList: {
        group: 'block',
        content: 'listItem+',
        parseDOM: [{ tag: 'ul' }],
        toDOM() {
          return ['ul', 0]
        },
      },
      orderedList: {
        group: 'block',
        content: 'listItem+',
        attrs: { start: { default: 1 } },
        parseDOM: [{ tag: 'ol' }],
        toDOM(node) {
          return ['ol', { start: node.attrs.start }, 0]
        },
      },
      listItem: {
        content: 'paragraph block*',
        parseDOM: [{ tag: 'li' }],
        toDOM() {
          return ['li', 0]
        },
      },
    }
  },
})

/**
 * Headers and Footers extension for WriterKit.
 * Manages page headers and footers with dynamic content.
 *
 * @remarks
 * This extension is not yet implemented. It will include:
 * - Header/footer regions per page
 * - Different first page header/footer
 * - Odd/even page variations
 * - Dynamic fields (page numbers, dates, etc.)
 */
export const HeadersFooters = Extension.create({
  name: 'headersFooters',

  addNodes() {
    return {
      pageHeader: {
        group: 'block',
        content: 'inline*',
        attrs: {
          showOnFirstPage: { default: true },
        },
        parseDOM: [{ tag: 'header' }],
        toDOM() {
          return ['header', 0]
        },
      },
      pageFooter: {
        group: 'block',
        content: 'inline*',
        attrs: {
          showOnFirstPage: { default: true },
        },
        parseDOM: [{ tag: 'footer' }],
        toDOM() {
          return ['footer', 0]
        },
      },
    }
  },
})

/**
 * Bundle of all WriterKit extensions.
 */
export const WriterKitExtensions = [Tables, Images, Lists, HeadersFooters]
