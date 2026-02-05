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
import type { CommandFunction } from '../core'
import type { Node as PMNode } from 'prosemirror-model'

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
  /** Default number of rows for new tables */
  defaultRows?: number
  /** Default number of columns for new tables */
  defaultCols?: number
  /** Enable page-aware table splitting */
  allowPageSplit?: boolean
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
  /** Default image alignment */
  defaultAlign?: 'left' | 'center' | 'right'
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
  /** Default header content */
  defaultHeader?: string
  /** Default footer content */
  defaultFooter?: string
}

/**
 * Options for the Lists extension.
 */
export interface ListOptions {
  /** Default ordered list type */
  defaultOrderedType?: '1' | 'a' | 'A' | 'i' | 'I'
  /** Enable task lists */
  taskLists?: boolean
}

// =============================================================================
// Tables Extension
// =============================================================================

/**
 * Tables extension for WriterKit.
 * Provides table creation, editing, and formatting capabilities.
 */
export const TableExtension = Extension.create({
  name: 'tables',

  addOptions() {
    return {
      resizable: true as boolean,
      cellBackgrounds: true as boolean,
      cellBorders: true as boolean,
      defaultRows: 3,
      defaultCols: 3,
      allowPageSplit: true as boolean,
    }
  },

  addNodes() {
    return {
      table: {
        group: 'block',
        content: 'tableRow+',
        tableRole: 'table',
        attrs: {
          /** Allow table to split across pages */
          allowPageSplit: { default: true },
        },
        parseDOM: [
          {
            tag: 'table',
            getAttrs(dom) {
              const el = dom as HTMLElement
              return {
                allowPageSplit: el.getAttribute('data-page-split') !== 'false',
              }
            },
          },
        ],
        toDOM(node) {
          return [
            'table',
            {
              class: 'writerkit-table',
              'data-page-split': String(node.attrs.allowPageSplit),
            },
            ['tbody', 0],
          ]
        },
      },
      tableRow: {
        content: '(tableCell | tableHeader)+',
        tableRole: 'row',
        attrs: {
          /** Keep this row with the next row (don't split between them) */
          keepWithNext: { default: false },
        },
        parseDOM: [
          {
            tag: 'tr',
            getAttrs(dom) {
              const el = dom as HTMLElement
              return {
                keepWithNext: el.getAttribute('data-keep-next') === 'true',
              }
            },
          },
        ],
        toDOM(node) {
          const attrs: Record<string, string> = {}
          if (node.attrs.keepWithNext) {
            attrs['data-keep-next'] = 'true'
          }
          return ['tr', attrs, 0]
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

  addCommands() {
    return {
      /**
       * Insert a new table at the current cursor position.
       */
      insertTable:
        (options?: { rows?: number; cols?: number; withHeaderRow?: boolean }) =>
        ({ state, dispatch }): boolean => {
          const { rows = 3, cols = 3, withHeaderRow = true } = options || {}
          const { schema, tr, selection } = state

          const tableNode = schema.nodes.table
          const rowNode = schema.nodes.tableRow
          const cellNode = schema.nodes.tableCell
          const headerNode = schema.nodes.tableHeader
          const paragraphNode = schema.nodes.paragraph

          if (!tableNode || !rowNode || !cellNode || !paragraphNode) {
            return false
          }

          const createCell = (isHeader: boolean) => {
            const cellType = isHeader && headerNode ? headerNode : cellNode
            return cellType.create(null, paragraphNode.create())
          }

          const createRow = (isHeader: boolean) => {
            const cells = []
            for (let i = 0; i < cols; i++) {
              cells.push(createCell(isHeader))
            }
            return rowNode.create(null, cells)
          }

          const tableRows = []
          for (let i = 0; i < rows; i++) {
            tableRows.push(createRow(withHeaderRow && i === 0))
          }

          const table = tableNode.create(null, tableRows)

          if (dispatch) {
            const pos = selection.$from.pos
            tr.insert(pos, table)
            dispatch(tr)
          }

          return true
        },

      /**
       * Delete the table at the current cursor position.
       */
      deleteTable:
        () =>
        ({ state, dispatch }): boolean => {
          const { selection, tr } = state
          const $pos = selection.$from

          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth)
            if (node.type.name === 'table') {
              if (dispatch) {
                const start = $pos.before(depth)
                const end = $pos.after(depth)
                tr.delete(start, end)
                dispatch(tr)
              }
              return true
            }
          }

          return false
        },

      /**
       * Add a row to the table (before or after current row).
       */
      addTableRow:
        (position: 'before' | 'after' = 'after') =>
        ({ state, dispatch }): boolean => {
          const { selection, tr, schema } = state
          const $pos = selection.$from

          // Find the current row
          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth)
            if (node.type.name === 'tableRow') {
              const rowNode = schema.nodes.tableRow
              const cellNode = schema.nodes.tableCell
              const paragraphNode = schema.nodes.paragraph

              if (!rowNode || !cellNode || !paragraphNode) return false

              // Count cells in current row
              const cellCount = node.childCount

              // Create new row with same number of cells
              const cells = []
              for (let i = 0; i < cellCount; i++) {
                cells.push(cellNode.create(null, paragraphNode.create()))
              }
              const newRow = rowNode.create(null, cells)

              if (dispatch) {
                const insertPos =
                  position === 'before' ? $pos.before(depth) : $pos.after(depth)
                tr.insert(insertPos, newRow)
                dispatch(tr)
              }

              return true
            }
          }

          return false
        },

      /**
       * Delete the current row from the table.
       */
      deleteTableRow:
        () =>
        ({ state, dispatch }): boolean => {
          const { selection, tr } = state
          const $pos = selection.$from

          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth)
            if (node.type.name === 'tableRow') {
              // Don't delete if it's the only row
              const tableDepth = depth - 1
              const table = $pos.node(tableDepth)
              if (table.childCount <= 1) return false

              if (dispatch) {
                const start = $pos.before(depth)
                const end = $pos.after(depth)
                tr.delete(start, end)
                dispatch(tr)
              }

              return true
            }
          }

          return false
        },

      /**
       * Set the background color of the current cell.
       */
      setCellBackground:
        (color: string | null) =>
        ({ state, dispatch }): boolean => {
          const { selection, tr } = state
          const $pos = selection.$from

          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth)
            if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
              if (dispatch) {
                const pos = $pos.before(depth)
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  background: color,
                })
                dispatch(tr)
              }
              return true
            }
          }

          return false
        },

      /**
       * Toggle whether the table can split across pages.
       */
      toggleTablePageSplit:
        () =>
        ({ state, dispatch }): boolean => {
          const { selection, tr } = state
          const $pos = selection.$from

          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth)
            if (node.type.name === 'table') {
              if (dispatch) {
                const pos = $pos.before(depth)
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  allowPageSplit: !node.attrs.allowPageSplit,
                })
                dispatch(tr)
              }
              return true
            }
          }

          return false
        },
    } as Record<string, (...args: unknown[]) => CommandFunction>
  },
})

// =============================================================================
// Images Extension
// =============================================================================

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
      resizable: true as boolean,
      captions: true as boolean,
      defaultAlign: 'center' as 'left' | 'center' | 'right',
    }
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
        attrs: {
          align: { default: 'center' },
        },
        parseDOM: [
          {
            tag: 'figure',
            getAttrs(dom) {
              const el = dom as HTMLElement
              return {
                align: el.getAttribute('data-align') || 'center',
              }
            },
          },
        ],
        toDOM(node) {
          return [
            'figure',
            {
              class: 'writerkit-figure',
              'data-align': node.attrs.align,
            },
            0,
          ]
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

  addCommands() {
    return {
      /**
       * Insert an image at the current cursor position.
       */
      insertImage:
        (options: { src: string; alt?: string; title?: string; width?: number; height?: number }) =>
        ({ state, dispatch }): boolean => {
          const { schema, tr, selection } = state
          const imageNode = schema.nodes.image

          if (!imageNode) return false

          const image = imageNode.create({
            src: options.src,
            alt: options.alt || null,
            title: options.title || null,
            width: options.width || null,
            height: options.height || null,
            align: 'center',
          })

          if (dispatch) {
            tr.insert(selection.$from.pos, image)
            dispatch(tr)
          }

          return true
        },

      /**
       * Insert a figure with an image and optional caption.
       */
      insertFigure:
        (options: { src: string; alt?: string; caption?: string }) =>
        ({ state, dispatch }): boolean => {
          const { schema, tr, selection } = state
          const figureNode = schema.nodes.figure
          const imageNode = schema.nodes.image
          const captionNode = schema.nodes.figcaption

          if (!figureNode || !imageNode) return false

          const image = imageNode.create({
            src: options.src,
            alt: options.alt || null,
          })

          const content = [image]
          if (options.caption && captionNode) {
            content.push(captionNode.create(null, schema.text(options.caption)))
          }

          const figure = figureNode.create(null, content)

          if (dispatch) {
            tr.insert(selection.$from.pos, figure)
            dispatch(tr)
          }

          return true
        },

      /**
       * Set the alignment of the current image.
       */
      setImageAlign:
        (align: 'left' | 'center' | 'right') =>
        ({ state, dispatch }): boolean => {
          const { selection, tr } = state
          const $pos = selection.$from

          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth)
            if (node.type.name === 'image' || node.type.name === 'figure') {
              if (dispatch) {
                const pos = $pos.before(depth)
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  align,
                })
                dispatch(tr)
              }
              return true
            }
          }

          return false
        },

      /**
       * Resize the current image.
       */
      resizeImage:
        (options: { width?: number; height?: number }) =>
        ({ state, dispatch }): boolean => {
          const { selection, tr } = state
          const $pos = selection.$from

          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth)
            if (node.type.name === 'image') {
              if (dispatch) {
                const pos = $pos.before(depth)
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  width: options.width ?? node.attrs.width,
                  height: options.height ?? node.attrs.height,
                })
                dispatch(tr)
              }
              return true
            }
          }

          return false
        },

      /**
       * Delete the current image.
       */
      deleteImage:
        () =>
        ({ state, dispatch }): boolean => {
          const { selection, tr } = state
          const $pos = selection.$from

          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth)
            if (node.type.name === 'image' || node.type.name === 'figure') {
              if (dispatch) {
                const start = $pos.before(depth)
                const end = $pos.after(depth)
                tr.delete(start, end)
                dispatch(tr)
              }
              return true
            }
          }

          return false
        },
    } as Record<string, (...args: unknown[]) => CommandFunction>
  },
})

// =============================================================================
// Headers and Footers Extension
// =============================================================================

/**
 * Headers and Footers extension for WriterKit.
 * Manages page headers and footers with dynamic content.
 */
export const HeaderFooterExtension = Extension.create({
  name: 'headersFooters',

  addOptions() {
    return {
      showOnFirstPage: true as boolean,
      oddEvenPages: false as boolean,
      variables: ['pageNumber', 'totalPages', 'title', 'author', 'date'],
      defaultHeader: '',
      defaultFooter: 'Page {{pageNumber}} of {{totalPages}}',
    }
  },

  addStorage() {
    return {
      /** Current header template */
      headerTemplate: '',
      /** Current footer template */
      footerTemplate: 'Page {{pageNumber}} of {{totalPages}}',
      /** Whether headers/footers are enabled */
      enabled: true,
    }
  },

  addNodes() {
    return {
      pageHeader: {
        group: 'block',
        content: 'inline*',
        attrs: {
          showOnFirstPage: { default: true },
          pageType: { default: 'all' }, // 'all', 'odd', 'even', 'first'
          align: { default: 'center' },
        },
        parseDOM: [
          {
            tag: 'header[data-page-header]',
            getAttrs(dom) {
              const el = dom as HTMLElement
              return {
                showOnFirstPage: el.getAttribute('data-show-first') !== 'false',
                pageType: el.getAttribute('data-page-type') || 'all',
                align: el.getAttribute('data-align') || 'center',
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
              'data-align': node.attrs.align,
              class: `writerkit-page-header align-${node.attrs.align}`,
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
          align: { default: 'center' },
        },
        parseDOM: [
          {
            tag: 'footer[data-page-footer]',
            getAttrs(dom) {
              const el = dom as HTMLElement
              return {
                showOnFirstPage: el.getAttribute('data-show-first') !== 'false',
                pageType: el.getAttribute('data-page-type') || 'all',
                align: el.getAttribute('data-align') || 'center',
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
              'data-align': node.attrs.align,
              class: `writerkit-page-footer align-${node.attrs.align}`,
            },
            0,
          ]
        },
      },
      pageNumber: {
        group: 'inline',
        inline: true,
        atom: true,
        attrs: {
          format: { default: 'decimal' }, // 'decimal', 'roman', 'alpha'
        },
        parseDOM: [{ tag: 'span[data-page-number]' }],
        toDOM(node) {
          return [
            'span',
            {
              'data-page-number': 'true',
              'data-format': node.attrs.format,
              class: 'writerkit-page-number',
            },
            '{{pageNumber}}',
          ]
        },
      },
      totalPages: {
        group: 'inline',
        inline: true,
        atom: true,
        parseDOM: [{ tag: 'span[data-total-pages]' }],
        toDOM() {
          return [
            'span',
            {
              'data-total-pages': 'true',
              class: 'writerkit-total-pages',
            },
            '{{totalPages}}',
          ]
        },
      },
    }
  },

  addCommands() {
    return {
      /**
       * Set the header template for the document.
       */
      setHeader:
        (options: { content?: string; showOnFirstPage?: boolean; align?: 'left' | 'center' | 'right' }) =>
        ({ state, dispatch }): boolean => {
          const { schema, tr } = state
          const headerNode = schema.nodes.pageHeader

          if (!headerNode) return false

          // For now, this just stores the template - actual rendering happens during pagination
          if (dispatch) {
            // Store in document metadata or extension storage
            tr.setMeta('headerTemplate', {
              content: options.content || '',
              showOnFirstPage: options.showOnFirstPage ?? true,
              align: options.align || 'center',
            })
            dispatch(tr)
          }

          return true
        },

      /**
       * Set the footer template for the document.
       */
      setFooter:
        (options: { content?: string; showOnFirstPage?: boolean; align?: 'left' | 'center' | 'right' }) =>
        ({ state, dispatch }): boolean => {
          const { schema, tr } = state
          const footerNode = schema.nodes.pageFooter

          if (!footerNode) return false

          if (dispatch) {
            tr.setMeta('footerTemplate', {
              content: options.content || 'Page {{pageNumber}} of {{totalPages}}',
              showOnFirstPage: options.showOnFirstPage ?? true,
              align: options.align || 'center',
            })
            dispatch(tr)
          }

          return true
        },

      /**
       * Insert a page number placeholder at the current position.
       */
      insertPageNumber:
        (format: 'decimal' | 'roman' | 'alpha' = 'decimal') =>
        ({ state, dispatch }): boolean => {
          const { schema, tr, selection } = state
          const pageNumberNode = schema.nodes.pageNumber

          if (!pageNumberNode) return false

          if (dispatch) {
            const node = pageNumberNode.create({ format })
            tr.insert(selection.$from.pos, node)
            dispatch(tr)
          }

          return true
        },

      /**
       * Insert a total pages placeholder at the current position.
       */
      insertTotalPages:
        () =>
        ({ state, dispatch }): boolean => {
          const { schema, tr, selection } = state
          const totalPagesNode = schema.nodes.totalPages

          if (!totalPagesNode) return false

          if (dispatch) {
            const node = totalPagesNode.create()
            tr.insert(selection.$from.pos, node)
            dispatch(tr)
          }

          return true
        },

      /**
       * Remove headers from the document.
       */
      removeHeader:
        () =>
        ({ state, dispatch }): boolean => {
          if (dispatch) {
            const { tr } = state
            tr.setMeta('headerTemplate', null)
            dispatch(tr)
          }
          return true
        },

      /**
       * Remove footers from the document.
       */
      removeFooter:
        () =>
        ({ state, dispatch }): boolean => {
          if (dispatch) {
            const { tr } = state
            tr.setMeta('footerTemplate', null)
            dispatch(tr)
          }
          return true
        },
    } as Record<string, (...args: unknown[]) => CommandFunction>
  },
})

// =============================================================================
// Lists Extension
// =============================================================================

/**
 * Lists extension for WriterKit.
 * Provides ordered, unordered, and nested list support.
 */
export const ListsExtension = Extension.create({
  name: 'lists',

  addOptions() {
    return {
      defaultOrderedType: '1' as '1' | 'a' | 'A' | 'i' | 'I',
      taskLists: false as boolean,
    }
  },

  addNodes() {
    return {
      bulletList: {
        group: 'block',
        content: 'listItem+',
        parseDOM: [{ tag: 'ul' }],
        toDOM() {
          return ['ul', { class: 'writerkit-bullet-list' }, 0]
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
          const attrs: Record<string, string | number> = {
            class: 'writerkit-ordered-list',
          }
          if (node.attrs.start !== 1) attrs.start = node.attrs.start
          if (node.attrs.type !== '1') attrs.type = node.attrs.type
          return ['ol', attrs, 0]
        },
      },
      listItem: {
        content: 'paragraph block*',
        attrs: {
          /** For task lists */
          checked: { default: null },
        },
        parseDOM: [
          {
            tag: 'li',
            getAttrs(dom) {
              const el = dom as HTMLElement
              const checkbox = el.querySelector('input[type="checkbox"]')
              return {
                checked: checkbox ? (checkbox as HTMLInputElement).checked : null,
              }
            },
          },
        ],
        toDOM(node) {
          if (node.attrs.checked !== null) {
            return [
              'li',
              { class: 'writerkit-task-item', 'data-checked': String(node.attrs.checked) },
              0,
            ]
          }
          return ['li', 0]
        },
      },
    }
  },

  addCommands() {
    return {
      /**
       * Toggle a bullet list at the current selection.
       */
      toggleBulletList:
        () =>
        ({ state, dispatch }): boolean => {
          const { selection, tr, schema } = state
          const bulletList = schema.nodes.bulletList
          const listItem = schema.nodes.listItem
          const paragraph = schema.nodes.paragraph

          if (!bulletList || !listItem || !paragraph) return false

          // Check if we're already in a bullet list
          const $pos = selection.$from
          for (let depth = $pos.depth; depth > 0; depth--) {
            if ($pos.node(depth).type === bulletList) {
              // Unwrap the list
              if (dispatch) {
                // Convert list items back to paragraphs
                const start = $pos.before(depth)
                const end = $pos.after(depth)
                const node = $pos.node(depth)
                const content: PMNode[] = []

                node.forEach((child) => {
                  if (child.type === listItem) {
                    child.forEach((item) => {
                      if (item.type === paragraph) {
                        content.push(item)
                      }
                    })
                  }
                })

                tr.replaceWith(start, end, content)
                dispatch(tr)
              }
              return true
            }
          }

          // Wrap selection in bullet list
          if (dispatch) {
            const item = listItem.create(null, paragraph.create(null, selection.content().content))
            const list = bulletList.create(null, item)
            tr.replaceSelectionWith(list)
            dispatch(tr)
          }

          return true
        },

      /**
       * Toggle an ordered list at the current selection.
       */
      toggleOrderedList:
        () =>
        ({ state, dispatch }): boolean => {
          const { selection, tr, schema } = state
          const orderedList = schema.nodes.orderedList
          const listItem = schema.nodes.listItem
          const paragraph = schema.nodes.paragraph

          if (!orderedList || !listItem || !paragraph) return false

          // Check if we're already in an ordered list
          const $pos = selection.$from
          for (let depth = $pos.depth; depth > 0; depth--) {
            if ($pos.node(depth).type === orderedList) {
              // Unwrap the list
              if (dispatch) {
                const start = $pos.before(depth)
                const end = $pos.after(depth)
                const node = $pos.node(depth)
                const content: PMNode[] = []

                node.forEach((child) => {
                  if (child.type === listItem) {
                    child.forEach((item) => {
                      if (item.type === paragraph) {
                        content.push(item)
                      }
                    })
                  }
                })

                tr.replaceWith(start, end, content)
                dispatch(tr)
              }
              return true
            }
          }

          // Wrap selection in ordered list
          if (dispatch) {
            const item = listItem.create(null, paragraph.create(null, selection.content().content))
            const list = orderedList.create(null, item)
            tr.replaceSelectionWith(list)
            dispatch(tr)
          }

          return true
        },

      /**
       * Sink the current list item (increase nesting).
       */
      sinkListItem:
        () =>
        ({ state, dispatch }): boolean => {
          const { selection, tr, schema } = state
          const listItem = schema.nodes.listItem
          const bulletList = schema.nodes.bulletList

          if (!listItem || !bulletList) return false

          const $pos = selection.$from
          for (let depth = $pos.depth; depth > 0; depth--) {
            if ($pos.node(depth).type === listItem) {
              // Find previous sibling list item
              const listDepth = depth - 1
              const itemIndex = $pos.index(listDepth)

              if (itemIndex === 0) return false // Can't sink first item

              if (dispatch) {
                // Wrap current item in new sublist inside previous item
                const currentItem = $pos.node(depth)
                const start = $pos.before(depth)
                const end = $pos.after(depth)

                // Delete current item and add as sublist of previous
                tr.delete(start, end)

                // Find previous item's end position and insert sublist there
                const prevItemEnd = $pos.before(depth) - 1
                const sublist = bulletList.create(null, currentItem)
                tr.insert(prevItemEnd, sublist)

                dispatch(tr)
              }
              return true
            }
          }

          return false
        },

      /**
       * Lift the current list item (decrease nesting).
       */
      liftListItem:
        () =>
        ({ state, dispatch }): boolean => {
          const { selection, tr } = state
          const $pos = selection.$from

          // Find the deepest list item
          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth)
            if (node.type.name === 'listItem') {
              // Check if we're in a nested list
              const parentListDepth = depth - 1
              const grandparentDepth = parentListDepth - 1

              if (grandparentDepth > 0 && $pos.node(grandparentDepth).type.name === 'listItem') {
                // We're nested, lift to parent level
                if (dispatch) {
                  const start = $pos.before(depth)
                  const end = $pos.after(depth)
                  const item = $pos.node(depth)

                  // Move item to after the parent list item
                  tr.delete(start, end)
                  const insertPos = $pos.after(grandparentDepth)
                  tr.insert(insertPos, item)

                  dispatch(tr)
                }
                return true
              }
            }
          }

          return false
        },

      /**
       * Toggle task list checkbox on current item.
       */
      toggleTaskItem:
        () =>
        ({ state, dispatch }): boolean => {
          const { selection, tr } = state
          const $pos = selection.$from

          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth)
            if (node.type.name === 'listItem') {
              if (dispatch) {
                const pos = $pos.before(depth)
                const newChecked =
                  node.attrs.checked === null ? false : node.attrs.checked === false ? true : null

                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  checked: newChecked,
                })
                dispatch(tr)
              }
              return true
            }
          }

          return false
        },
    } as Record<string, (...args: unknown[]) => CommandFunction>
  },
})

// =============================================================================
// Legacy Exports
// =============================================================================

export const Tables = TableExtension
export const Images = ImageExtension
export const HeadersFooters = HeaderFooterExtension
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

/**
 * Create a custom extension bundle with selected extensions.
 */
export function createExtensionBundle(options: {
  tables?: boolean | Partial<TableOptions>
  images?: boolean | Partial<ImageOptions>
  headersFooters?: boolean | Partial<HeaderFooterOptions>
  lists?: boolean | Partial<ListOptions>
} = {}) {
  const extensions: Extension[] = []

  if (options.tables !== false) {
    const tableOpts = typeof options.tables === 'object' ? options.tables : undefined
    extensions.push(tableOpts ? TableExtension.configure(tableOpts as Record<string, unknown>) : TableExtension)
  }

  if (options.images !== false) {
    const imageOpts = typeof options.images === 'object' ? options.images : undefined
    extensions.push(imageOpts ? ImageExtension.configure(imageOpts as Record<string, unknown>) : ImageExtension)
  }

  if (options.headersFooters !== false) {
    const hfOpts = typeof options.headersFooters === 'object' ? options.headersFooters : undefined
    extensions.push(hfOpts ? HeaderFooterExtension.configure(hfOpts as Record<string, unknown>) : HeaderFooterExtension)
  }

  if (options.lists !== false) {
    const listOpts = typeof options.lists === 'object' ? options.lists : undefined
    extensions.push(listOpts ? ListsExtension.configure(listOpts as Record<string, unknown>) : ListsExtension)
  }

  return extensions
}
