/**
 * @writerkit/extensions
 *
 * Extensions for WriterKit editor providing markdown support.
 * Includes headings, lists, tables, formatting marks, and more.
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
  /** Default number of rows for new tables */
  defaultRows?: number
  /** Default number of columns for new tables */
  defaultCols?: number
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
// Heading Extension
// =============================================================================

/**
 * Heading extension for WriterKit.
 * Provides h1-h6 heading support.
 */
export const HeadingExtension = Extension.create({
  name: 'heading',

  addNodes() {
    return {
      heading: {
        group: 'block',
        content: 'inline*',
        attrs: {
          level: { default: 1 },
        },
        defining: true,
        parseDOM: [
          { tag: 'h1', attrs: { level: 1 } },
          { tag: 'h2', attrs: { level: 2 } },
          { tag: 'h3', attrs: { level: 3 } },
          { tag: 'h4', attrs: { level: 4 } },
          { tag: 'h5', attrs: { level: 5 } },
          { tag: 'h6', attrs: { level: 6 } },
        ],
        toDOM(node) {
          return [`h${node.attrs.level}`, 0]
        },
      },
    }
  },
})

// =============================================================================
// Blockquote Extension
// =============================================================================

/**
 * Blockquote extension for WriterKit.
 */
export const BlockquoteExtension = Extension.create({
  name: 'blockquote',

  addNodes() {
    return {
      blockquote: {
        group: 'block',
        content: 'block+',
        defining: true,
        parseDOM: [{ tag: 'blockquote' }],
        toDOM() {
          return ['blockquote', 0]
        },
      },
    }
  },
})

// =============================================================================
// Code Block Extension
// =============================================================================

/**
 * Code block extension for WriterKit.
 */
export const CodeBlockExtension = Extension.create({
  name: 'codeBlock',

  addNodes() {
    return {
      codeBlock: {
        group: 'block',
        content: 'text*',
        marks: '',
        code: true,
        defining: true,
        attrs: {
          language: { default: null },
        },
        parseDOM: [
          {
            tag: 'pre',
            preserveWhitespace: 'full' as const,
            getAttrs(dom) {
              const el = dom as HTMLElement
              const code = el.querySelector('code')
              return {
                language: code?.getAttribute('data-language') || null,
              }
            },
          },
        ],
        toDOM(node) {
          return [
            'pre',
            {},
            ['code', { 'data-language': node.attrs.language || undefined }, 0],
          ]
        },
      },
    }
  },
})

// =============================================================================
// Horizontal Rule Extension
// =============================================================================

/**
 * Horizontal rule extension for WriterKit.
 */
export const HorizontalRuleExtension = Extension.create({
  name: 'horizontalRule',

  addNodes() {
    return {
      horizontalRule: {
        group: 'block',
        parseDOM: [{ tag: 'hr' }],
        toDOM() {
          return ['hr']
        },
      },
    }
  },
})

// =============================================================================
// Hard Break Extension
// =============================================================================

/**
 * Hard break extension for WriterKit.
 */
export const HardBreakExtension = Extension.create({
  name: 'hardBreak',

  addNodes() {
    return {
      hardBreak: {
        inline: true,
        group: 'inline',
        selectable: false,
        parseDOM: [{ tag: 'br' }],
        toDOM() {
          return ['br']
        },
      },
    }
  },
})

// =============================================================================
// Bold Mark Extension
// =============================================================================

/**
 * Bold mark extension for WriterKit.
 */
export const BoldExtension = Extension.create({
  name: 'bold',

  addMarks() {
    return {
      bold: {
        parseDOM: [
          { tag: 'strong' },
          { tag: 'b' },
          { style: 'font-weight=bold' },
          { style: 'font-weight=700' },
        ],
        toDOM() {
          return ['strong', 0]
        },
      },
    }
  },
})

// =============================================================================
// Italic Mark Extension
// =============================================================================

/**
 * Italic mark extension for WriterKit.
 */
export const ItalicExtension = Extension.create({
  name: 'italic',

  addMarks() {
    return {
      italic: {
        parseDOM: [
          { tag: 'em' },
          { tag: 'i' },
          { style: 'font-style=italic' },
        ],
        toDOM() {
          return ['em', 0]
        },
      },
    }
  },
})

// =============================================================================
// Code Mark Extension
// =============================================================================

/**
 * Inline code mark extension for WriterKit.
 */
export const CodeExtension = Extension.create({
  name: 'code',

  addMarks() {
    return {
      code: {
        parseDOM: [{ tag: 'code' }],
        toDOM() {
          return ['code', 0]
        },
      },
    }
  },
})

// =============================================================================
// Link Mark Extension
// =============================================================================

/**
 * Link mark extension for WriterKit.
 */
export const LinkExtension = Extension.create({
  name: 'link',

  addMarks() {
    return {
      link: {
        attrs: {
          href: {},
          title: { default: null },
        },
        inclusive: false,
        parseDOM: [
          {
            tag: 'a[href]',
            getAttrs(dom) {
              const el = dom as HTMLElement
              return {
                href: el.getAttribute('href'),
                title: el.getAttribute('title'),
              }
            },
          },
        ],
        toDOM(node) {
          return ['a', { href: node.attrs.href, title: node.attrs.title }, 0]
        },
      },
    }
  },
})

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
      defaultRows: 3,
      defaultCols: 3,
    }
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

          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth)
            if (node.type.name === 'tableRow') {
              const rowNode = schema.nodes.tableRow
              const cellNode = schema.nodes.tableCell
              const paragraphNode = schema.nodes.paragraph

              if (!rowNode || !cellNode || !paragraphNode) return false

              const cellCount = node.childCount

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
          type: { default: '1' },
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

          const $pos = selection.$from
          for (let depth = $pos.depth; depth > 0; depth--) {
            if ($pos.node(depth).type === bulletList) {
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

          const $pos = selection.$from
          for (let depth = $pos.depth; depth > 0; depth--) {
            if ($pos.node(depth).type === orderedList) {
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

          if (dispatch) {
            const item = listItem.create(null, paragraph.create(null, selection.content().content))
            const list = orderedList.create(null, item)
            tr.replaceSelectionWith(list)
            dispatch(tr)
          }

          return true
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
// Extension Bundles
// =============================================================================

/**
 * Bundle of basic text extensions for markdown support.
 */
export const BasicTextExtensions = [
  HeadingExtension,
  BlockquoteExtension,
  CodeBlockExtension,
  HorizontalRuleExtension,
  HardBreakExtension,
  BoldExtension,
  ItalicExtension,
  CodeExtension,
  LinkExtension,
]

/**
 * Bundle of all WriterKit extensions.
 */
export const WriterKitExtensions = [
  ...BasicTextExtensions,
  TableExtension,
  ListsExtension,
]

// Legacy exports
export const Tables = TableExtension
export const Lists = ListsExtension
export const Heading = HeadingExtension
export const Blockquote = BlockquoteExtension
export const CodeBlock = CodeBlockExtension
export const HorizontalRule = HorizontalRuleExtension
export const HardBreak = HardBreakExtension
export const Bold = BoldExtension
export const Italic = ItalicExtension
export const Code = CodeExtension
export const Link = LinkExtension
