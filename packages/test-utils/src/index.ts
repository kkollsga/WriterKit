/**
 * @writerkit/test-utils
 *
 * Testing utilities for WriterKit packages.
 */

import type { JSONContent, DocumentMetadata } from 'writerkit/core'

/**
 * Create a minimal valid ProseMirror document
 */
export function createDoc(...content: JSONContent[]): JSONContent {
  return {
    type: 'doc',
    content,
  }
}

/**
 * Create a paragraph node
 */
export function createParagraph(text: string): JSONContent {
  return {
    type: 'paragraph',
    content: text ? [{ type: 'text', text }] : [],
  }
}

/**
 * Create a heading node
 */
export function createHeading(level: 1 | 2 | 3 | 4 | 5 | 6, text: string): JSONContent {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

/**
 * Create a code block node
 */
export function createCodeBlock(code: string, language?: string): JSONContent {
  return {
    type: 'codeBlock',
    attrs: { language: language ?? null },
    content: [{ type: 'text', text: code }],
  }
}

/**
 * Create a blockquote node
 */
export function createBlockquote(...content: JSONContent[]): JSONContent {
  return {
    type: 'blockquote',
    content,
  }
}

/**
 * Create a bullet list node
 */
export function createBulletList(...items: string[]): JSONContent {
  return {
    type: 'bulletList',
    content: items.map((text) => ({
      type: 'listItem',
      content: [createParagraph(text)],
    })),
  }
}

/**
 * Create an ordered list node
 */
export function createOrderedList(...items: string[]): JSONContent {
  return {
    type: 'orderedList',
    attrs: { start: 1 },
    content: items.map((text) => ({
      type: 'listItem',
      content: [createParagraph(text)],
    })),
  }
}

/**
 * Create a page break node
 */
export function createPageBreak(): JSONContent {
  return { type: 'pageBreak' }
}

/**
 * Create a horizontal rule node
 */
export function createHorizontalRule(): JSONContent {
  return { type: 'horizontalRule' }
}

/**
 * Create text with marks (bold, italic, code, link)
 */
export function createText(
  text: string,
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
): JSONContent {
  const node: JSONContent = { type: 'text', text }
  if (marks && marks.length > 0) {
    node.marks = marks
  }
  return node
}

/**
 * Create bold text
 */
export function createBold(text: string): JSONContent {
  return createText(text, [{ type: 'bold' }])
}

/**
 * Create italic text
 */
export function createItalic(text: string): JSONContent {
  return createText(text, [{ type: 'italic' }])
}

/**
 * Create inline code text
 */
export function createInlineCode(text: string): JSONContent {
  return createText(text, [{ type: 'code' }])
}

/**
 * Create a link
 */
export function createLink(text: string, href: string, title?: string): JSONContent {
  return createText(text, [
    { type: 'link', attrs: { href, title: title ?? null } },
  ])
}

/**
 * Create default test metadata
 */
export function createTestMetadata(
  overrides: Partial<DocumentMetadata> = {}
): DocumentMetadata {
  return {
    title: 'Test Document',
    createdAt: '2025-01-01T00:00:00Z',
    modifiedAt: '2025-01-01T00:00:00Z',
    pageSize: 'a4',
    orientation: 'portrait',
    margins: {
      top: 72,
      right: 72,
      bottom: 72,
      left: 72,
    },
    ...overrides,
  }
}

/**
 * Deep compare two JSONContent objects
 * Returns true if structurally equal (ignoring undefined values)
 */
export function isStructurallyEqual(a: JSONContent, b: JSONContent): boolean {
  if (a.type !== b.type) return false

  // Compare text
  if (a.text !== b.text) return false

  // Compare attrs
  const aAttrs = a.attrs ?? {}
  const bAttrs = b.attrs ?? {}
  const aAttrsKeys = Object.keys(aAttrs)
  const bAttrsKeys = Object.keys(bAttrs)
  if (aAttrsKeys.length !== bAttrsKeys.length) return false
  for (const key of aAttrsKeys) {
    if (aAttrs[key] !== bAttrs[key]) return false
  }

  // Compare marks
  const aMarks = a.marks ?? []
  const bMarks = b.marks ?? []
  if (aMarks.length !== bMarks.length) return false
  for (let i = 0; i < aMarks.length; i++) {
    if (aMarks[i].type !== bMarks[i].type) return false
  }

  // Compare content
  const aContent = a.content ?? []
  const bContent = b.content ?? []
  if (aContent.length !== bContent.length) return false
  for (let i = 0; i < aContent.length; i++) {
    if (!isStructurallyEqual(aContent[i], bContent[i])) return false
  }

  return true
}

/**
 * Count nodes of a specific type in a document
 */
export function countNodes(doc: JSONContent, type: string): number {
  let count = 0

  function visit(node: JSONContent) {
    if (node.type === type) count++
    if (node.content) {
      for (const child of node.content) {
        visit(child)
      }
    }
  }

  visit(doc)
  return count
}

/**
 * Find all nodes of a specific type in a document
 */
export function findNodes(doc: JSONContent, type: string): JSONContent[] {
  const found: JSONContent[] = []

  function visit(node: JSONContent) {
    if (node.type === type) found.push(node)
    if (node.content) {
      for (const child of node.content) {
        visit(child)
      }
    }
  }

  visit(doc)
  return found
}

/**
 * Get all text content from a document
 */
export function getTextContent(doc: JSONContent): string {
  const parts: string[] = []

  function visit(node: JSONContent) {
    if (node.text) parts.push(node.text)
    if (node.content) {
      for (const child of node.content) {
        visit(child)
      }
    }
  }

  visit(doc)
  return parts.join('')
}
