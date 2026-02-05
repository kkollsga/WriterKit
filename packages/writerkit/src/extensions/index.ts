/**
 * @writerkit/extensions
 *
 * Rich content extensions for WriterKit editor.
 * Provides support for tables, images, lists, headers/footers,
 * and other complex document elements beyond basic text.
 *
 * @packageDocumentation
 */

import { Extension } from '../core'

/**
 * Options for the Tables extension.
 */
export interface TableOptions {
  /** Allow resizable columns */
  resizable?: boolean
  /** Allow cell background colors */
  cellBackgrounds?: boolean
  /** Allow cell borders */
  cellBorders?: boolean
}

/**
 * Options for the Image extension.
 */
export interface ImageOptions {
  /** Allowed image MIME types */
  allowedTypes?: string[]
  /** Maximum image size in bytes */
  maxSize?: number
  /** Enable image resizing */
  resizable?: boolean
  /** Enable image captions */
  captions?: boolean
}

/**
 * Options for the HeaderFooter extension.
 */
export interface HeaderFooterOptions {
  /** Show header/footer on first page */
  showOnFirstPage?: boolean
  /** Different header/footer for odd/even pages */
  oddEvenPages?: boolean
  /** Available template variables */
  variables?: string[]
}

/**
 * Tables extension for WriterKit.
 * Provides table creation, editing, and formatting capabilities.
 */
export const TableExtension = Extension.create({
  name: 'tables',

  addOptions() {
    return {
      resizable: true,
      cellBackgrounds: true,
      cellBorders: true,
    } satisfies TableOptions
  },

  addNodes() {
    return {
      table: {
        group: 'block',
        content: 'tableRow+',
        tableRole: 'table',
        parseDOM: [{ tag: 'table' }],
        toDOM() {
          return ['table', { class: 'writerkit-table' }, ['tbody', 0]]
        },
      },
      tableRow: {
        content: '(tableCell | tableHeader)+',
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
          colwidth: { default: null },
          background: { default: null },
        },
        parseDOM: [
          {
            tag: 'td',
            getAttrs(dom) {
              const el = dom as HTMLElement
              return {
                colspan: Number(el.getAttribute('colspan')) || 1,
                rowspan: Number(el.getAttribute('rowspan')) || 1,
                colwidth: el.getAttribute('data-colwidth')?.split(',').map(Number) || null,
                background: el.style.backgroundColor || null,
              }
            },
          },
        ],
        toDOM(node) {
          const attrs: Record<string, string> = {}
          if (node.attrs.colspan !== 1) attrs.colspan = String(node.attrs.colspan)
          if (node.attrs.rowspan !== 1) attrs.rowspan = String(node.attrs.rowspan)
          if (node.attrs.colwidth) attrs['data-colwidth'] = node.attrs.colwidth.join(',')
          if (node.attrs.background) attrs.style = `background-color: ${node.attrs.background}`
          return ['td', attrs, 0]
        },
      },
      tableHeader: {
        content: 'block+',
        tableRole: 'header_cell',
        attrs: {
          colspan: { default: 1 },
          rowspan: { default: 1 },
          colwidth: { default: null },
          background: { default: null },
        },
        parseDOM: [
          {
            tag: 'th',
            getAttrs(dom) {
              const el = dom as HTMLElement
              return {
                colspan: Number(el.getAttribute('colspan')) || 1,
                rowspan: Number(el.getAttribute('rowspan')) || 1,
                colwidth: el.getAttribute('data-colwidth')?.split(',').map(Number) || null,
                background: el.style.backgroundColor || null,
              }
            },
          },
        ],
        toDOM(node) {
          const attrs: Record<string, string> = {}
          if (node.attrs.colspan !== 1) attrs.colspan = String(node.attrs.colspan)
          if (node.attrs.rowspan !== 1) attrs.rowspan = String(node.attrs.rowspan)
          if (node.attrs.colwidth) attrs['data-colwidth'] = node.attrs.colwidth.join(',')
          if (node.attrs.background) attrs.style = `background-color: ${node.attrs.background}`
          return ['th', attrs, 0]
        },
      },
    }
  },
})

/**
 * Images extension for WriterKit.
 * Handles image insertion, positioning, and formatting.
 */
export const ImageExtension = Extension.create({
  name: 'images',

  addOptions() {
    return {
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxSize: 10 * 1024 * 1024, // 10MB
      resizable: true,
      captions: true,
    } satisfies ImageOptions
  },

  addNodes() {
    return {
      image: {
        group: 'block',
        attrs: {
          src: { default: null },
          alt: { default: null },
          title: { default: null },
          width: { default: null },
          height: { default: null },
          align: { default: 'center' },
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
                align: el.getAttribute('data-align') || 'center',
              }
            },
          },
        ],
        toDOM(node) {
          const attrs: Record<string, string | null> = {
            src: node.attrs.src,
            alt: node.attrs.alt,
            title: node.attrs.title,
            'data-align': node.attrs.align,
          }
          if (node.attrs.width) attrs.width = String(node.attrs.width)
          if (node.attrs.height) attrs.height = String(node.attrs.height)
          return ['img', attrs]
        },
      },
      figure: {
        group: 'block',
        content: 'image figcaption?',
        parseDOM: [{ tag: 'figure' }],
        toDOM() {
          return ['figure', { class: 'writerkit-figure' }, 0]
        },
      },
      figcaption: {
        content: 'inline*',
        parseDOM: [{ tag: 'figcaption' }],
        toDOM() {
          return ['figcaption', 0]
        },
      },
    }
  },
})

/**
 * Headers and Footers extension for WriterKit.
 * Manages page headers and footers with dynamic content.
 */
export const HeaderFooterExtension = Extension.create({
  name: 'headersFooters',

  addOptions() {
    return {
      showOnFirstPage: true,
      oddEvenPages: false,
      variables: ['pageNumber', 'totalPages', 'title', 'author', 'date'],
    } satisfies HeaderFooterOptions
  },

  addNodes() {
    return {
      pageHeader: {
        group: 'block',
        content: 'inline*',
        attrs: {
          showOnFirstPage: { default: true },
          pageType: { default: 'all' }, // 'all', 'odd', 'even', 'first'
        },
        parseDOM: [
          {
            tag: 'header[data-page-header]',
            getAttrs(dom) {
              const el = dom as HTMLElement
              return {
                showOnFirstPage: el.getAttribute('data-show-first') !== 'false',
                pageType: el.getAttribute('data-page-type') || 'all',
              }
            },
          },
        ],
        toDOM(node) {
          return [
            'header',
            {
              'data-page-header': 'true',
              'data-show-first': String(node.attrs.showOnFirstPage),
              'data-page-type': node.attrs.pageType,
            },
            0,
          ]
        },
      },
      pageFooter: {
        group: 'block',
        content: 'inline*',
        attrs: {
          showOnFirstPage: { default: true },
          pageType: { default: 'all' },
        },
        parseDOM: [
          {
            tag: 'footer[data-page-footer]',
            getAttrs(dom) {
              const el = dom as HTMLElement
              return {
                showOnFirstPage: el.getAttribute('data-show-first') !== 'false',
                pageType: el.getAttribute('data-page-type') || 'all',
              }
            },
          },
        ],
        toDOM(node) {
          return [
            'footer',
            {
              'data-page-footer': 'true',
              'data-show-first': String(node.attrs.showOnFirstPage),
              'data-page-type': node.attrs.pageType,
            },
            0,
          ]
        },
      },
      pageNumber: {
        group: 'inline',
        inline: true,
        attrs: {
          format: { default: 'decimal' }, // 'decimal', 'roman', 'alpha'
        },
        parseDOM: [{ tag: 'span[data-page-number]' }],
        toDOM(node) {
          return ['span', { 'data-page-number': 'true', 'data-format': node.attrs.format }, '{{pageNumber}}']
        },
      },
    }
  },
})

// Legacy exports for backwards compatibility
export const Tables = TableExtension
export const Images = ImageExtension
export const HeadersFooters = HeaderFooterExtension

/**
 * Lists extension for WriterKit.
 * Provides ordered, unordered, and nested list support.
 */
export const ListsExtension = Extension.create({
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
        attrs: {
          start: { default: 1 },
          type: { default: '1' }, // '1', 'a', 'A', 'i', 'I'
        },
        parseDOM: [
          {
            tag: 'ol',
            getAttrs(dom) {
              const el = dom as HTMLElement
              return {
                start: Number(el.getAttribute('start')) || 1,
                type: el.getAttribute('type') || '1',
              }
            },
          },
        ],
        toDOM(node) {
          const attrs: Record<string, string | number> = {}
          if (node.attrs.start !== 1) attrs.start = node.attrs.start
          if (node.attrs.type !== '1') attrs.type = node.attrs.type
          return ['ol', attrs, 0]
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

export const Lists = ListsExtension

/**
 * Bundle of all WriterKit extensions.
 */
export const WriterKitExtensions = [
  TableExtension,
  ImageExtension,
  HeaderFooterExtension,
  ListsExtension,
]
