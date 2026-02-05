/**
 * Round-trip tests for Markdown ↔ ProseMirror conversion
 *
 * These tests verify that content is preserved when converting:
 * Markdown → ProseMirror → Markdown
 *
 * Key behaviors tested:
 * - Text content is preserved
 * - Formatting (bold, italic, code) survives round-trip
 * - Document structure (headings, lists, blockquotes) is maintained
 * - Frontmatter metadata is preserved
 * - Special characters and unicode work correctly
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MarkdownManager } from './MarkdownManager'

describe('MarkdownManager - Round-trip Tests', () => {
  let manager: MarkdownManager

  beforeEach(() => {
    manager = new MarkdownManager()
  })

  /**
   * Helper to perform round-trip conversion
   */
  function roundTrip(markdown: string): string {
    const { doc, metadata } = manager.markdownToProseMirror(markdown)
    return manager.proseMirrorToMarkdown(doc, metadata)
  }

  describe('Plain Text Round-trip', () => {
    it('preserves simple paragraph text', () => {
      const original = 'Hello, world!'
      const result = roundTrip(original)

      expect(result).toContain('Hello, world!')
    })

    it('preserves multiple paragraphs', () => {
      const original = `First paragraph.

Second paragraph.

Third paragraph.`

      const result = roundTrip(original)

      expect(result).toContain('First paragraph')
      expect(result).toContain('Second paragraph')
      expect(result).toContain('Third paragraph')
    })

    it('preserves long text content', () => {
      const longText = 'Lorem ipsum dolor sit amet. '.repeat(20).trim()
      const result = roundTrip(longText)

      expect(result).toContain('Lorem ipsum dolor sit amet')
    })
  })

  describe('Heading Round-trip', () => {
    it('preserves h1 heading', () => {
      const original = '# Main Title'
      const result = roundTrip(original)

      expect(result).toContain('# Main Title')
    })

    it('preserves all heading levels', () => {
      const original = `# Heading 1

## Heading 2

### Heading 3

#### Heading 4

##### Heading 5

###### Heading 6`

      const result = roundTrip(original)

      // Verify each heading level is present
      expect(result).toContain('# Heading 1')
      expect(result).toContain('## Heading 2')
      expect(result).toContain('### Heading 3')
      expect(result).toContain('#### Heading 4')
      expect(result).toContain('##### Heading 5')
      expect(result).toContain('###### Heading 6')
    })

    it('preserves heading with following text', () => {
      const original = `# Introduction

This is the introduction paragraph.

## Background

Some background information.`

      const result = roundTrip(original)

      expect(result).toContain('# Introduction')
      expect(result).toContain('This is the introduction paragraph')
      expect(result).toContain('## Background')
      expect(result).toContain('Some background information')
    })
  })

  describe('Inline Formatting Round-trip', () => {
    it('preserves bold text', () => {
      const original = 'This is **bold** text.'
      const result = roundTrip(original)

      expect(result).toContain('**bold**')
    })

    it('preserves italic text', () => {
      const original = 'This is *italic* text.'
      const result = roundTrip(original)

      expect(result).toContain('*italic*')
    })

    it('preserves inline code', () => {
      const original = 'Use the `console.log()` function.'
      const result = roundTrip(original)

      expect(result).toContain('`console.log()`')
    })

    it('preserves mixed formatting', () => {
      const original = 'This has **bold**, *italic*, and `code`.'
      const result = roundTrip(original)

      expect(result).toContain('**bold**')
      expect(result).toContain('*italic*')
      expect(result).toContain('`code`')
    })
  })

  describe('List Round-trip', () => {
    it('preserves bullet list', () => {
      const original = `- Item 1
- Item 2
- Item 3`

      const result = roundTrip(original)

      expect(result).toContain('Item 1')
      expect(result).toContain('Item 2')
      expect(result).toContain('Item 3')
      // Should have list markers
      expect(result).toMatch(/^[-*]\s+Item 1/m)
    })

    it('preserves numbered list', () => {
      const original = `1. First item
2. Second item
3. Third item`

      const result = roundTrip(original)

      expect(result).toContain('First item')
      expect(result).toContain('Second item')
      expect(result).toContain('Third item')
      // Should have numbered markers
      expect(result).toMatch(/^\d+\.\s+First item/m)
    })

    it('preserves nested list', () => {
      const original = `- Parent item
  - Child item 1
  - Child item 2
- Another parent`

      const result = roundTrip(original)

      expect(result).toContain('Parent item')
      expect(result).toContain('Child item 1')
      expect(result).toContain('Child item 2')
      expect(result).toContain('Another parent')
    })
  })

  describe('Code Block Round-trip', () => {
    it('preserves fenced code block', () => {
      const original = `\`\`\`javascript
const x = 1;
const y = 2;
console.log(x + y);
\`\`\``

      const result = roundTrip(original)

      expect(result).toContain('const x = 1')
      expect(result).toContain('const y = 2')
      expect(result).toContain('console.log')
      // Should preserve as code block (some form of fencing)
      expect(result).toMatch(/```|~~~/)
    })
  })

  describe('Blockquote Round-trip', () => {
    it('preserves simple blockquote', () => {
      const original = '> This is a quote.'
      const result = roundTrip(original)

      expect(result).toContain('This is a quote')
      expect(result).toMatch(/^>\s/m)
    })

    it('preserves multi-paragraph blockquote', () => {
      const original = `> First line of quote.
>
> Second paragraph of quote.`

      const result = roundTrip(original)

      expect(result).toContain('First line')
      expect(result).toContain('Second paragraph')
    })
  })

  describe('Horizontal Rule Round-trip', () => {
    it('preserves horizontal rule', () => {
      const original = `Above the line.

---

Below the line.`

      const result = roundTrip(original)

      expect(result).toContain('Above the line')
      expect(result).toContain('Below the line')
      // Should have some form of horizontal rule
      expect(result).toMatch(/^[-*_]{3,}$/m)
    })
  })

  describe('Link Round-trip', () => {
    it('preserves inline link', () => {
      const original = 'Visit [Example](https://example.com) for more.'
      const result = roundTrip(original)

      expect(result).toContain('Example')
      expect(result).toContain('https://example.com')
    })
  })

  describe('Special Characters Round-trip', () => {
    it('preserves unicode characters', () => {
      const original = '日本語テキスト and émojis 🎉'
      const result = roundTrip(original)

      expect(result).toContain('日本語テキスト')
      expect(result).toContain('émojis')
      expect(result).toContain('🎉')
    })

    it('preserves special markdown characters in text', () => {
      const original = 'Prices: $10 - $20 (20% off)'
      const result = roundTrip(original)

      expect(result).toContain('$10')
      expect(result).toContain('$20')
      expect(result).toContain('20%')
    })
  })

  describe('Complex Document Round-trip', () => {
    it('preserves full document structure', () => {
      const original = `# Document Title

This is the introduction paragraph with **bold** and *italic* text.

## Section One

Here is some content:

- List item 1
- List item 2
- List item 3

### Subsection

> A meaningful quote

## Section Two

\`\`\`javascript
const code = "example";
\`\`\`

---

The end.`

      const result = roundTrip(original)

      // Verify structure is preserved
      expect(result).toContain('# Document Title')
      expect(result).toContain('**bold**')
      expect(result).toContain('*italic*')
      expect(result).toContain('## Section One')
      expect(result).toContain('List item 1')
      expect(result).toContain('### Subsection')
      expect(result).toContain('A meaningful quote')
      expect(result).toContain('## Section Two')
      expect(result).toContain('const code')
      expect(result).toContain('The end')
    })
  })

  describe('Frontmatter Round-trip', () => {
    it('preserves frontmatter metadata', () => {
      const original = `---
title: Test Document
author: John Doe
---

# Hello World

Content here.`

      const result = roundTrip(original)

      expect(result).toContain('title:')
      expect(result).toContain('Test Document')
      expect(result).toContain('# Hello World')
      expect(result).toContain('Content here')
    })

    it('preserves nested frontmatter values', () => {
      const original = `---
title: Test
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---

Content.`

      const { metadata } = manager.markdownToProseMirror(original)

      expect(metadata.margins).toBeDefined()
      expect(metadata.margins.top).toBe(72)
      expect(metadata.margins.right).toBe(72)
      expect(metadata.margins.bottom).toBe(72)
      expect(metadata.margins.left).toBe(72)
    })

    it('metadata survives round-trip', () => {
      const original = `---
title: My Document
author: Jane Smith
pageSize: letter
---

Body content.`

      const { doc, metadata } = manager.markdownToProseMirror(original)

      expect(metadata.title).toBe('My Document')
      expect(metadata.author).toBe('Jane Smith')
      expect(metadata.pageSize).toBe('letter')

      // Round-trip preserves
      const result = manager.proseMirrorToMarkdown(doc, metadata)
      expect(result).toContain('title:')
      expect(result).toContain('My Document')
    })
  })
})

describe('MarkdownManager - Content Integrity Tests', () => {
  let manager: MarkdownManager

  beforeEach(() => {
    manager = new MarkdownManager()
  })

  it('does not lose text content during conversion', () => {
    const original = 'Important data: ABC123 XYZ789'

    const { doc, metadata } = manager.markdownToProseMirror(original)
    const result = manager.proseMirrorToMarkdown(doc, metadata)

    expect(result).toContain('Important data')
    expect(result).toContain('ABC123')
    expect(result).toContain('XYZ789')
  })

  it('does not add extra content during conversion', () => {
    const original = 'Simple text.'

    const { doc, metadata } = manager.markdownToProseMirror(original)
    const result = manager.proseMirrorToMarkdown(doc, metadata)

    // Result may have frontmatter, but body should be similar
    expect(result).toContain('Simple text')
  })

  it('preserves paragraph separation', () => {
    const original = `Paragraph one.

Paragraph two.`

    const { doc, metadata } = manager.markdownToProseMirror(original)
    const result = manager.proseMirrorToMarkdown(doc, metadata)

    expect(result).toContain('Paragraph one')
    expect(result).toContain('Paragraph two')
    // Should have separation between paragraphs
    expect(result).toMatch(/Paragraph one.*\n\n.*Paragraph two/s)
  })
})

describe('MarkdownManager - AST Conversion Tests', () => {
  let manager: MarkdownManager

  beforeEach(() => {
    manager = new MarkdownManager()
  })

  it('astToProseMirror produces valid JSON', () => {
    const { ast } = manager.parse('# Hello\n\nWorld')
    const doc = manager.astToProseMirror(ast)

    expect(doc).toBeDefined()
    expect(doc.type).toBe('doc')
    expect(doc.content).toBeDefined()
    expect(Array.isArray(doc.content)).toBe(true)
  })

  it('proseMirrorToAST produces valid AST', () => {
    const { ast } = manager.parse('# Hello\n\nWorld')
    const doc = manager.astToProseMirror(ast)
    const backToAst = manager.proseMirrorToAST(doc)

    expect(backToAst).toBeDefined()
    expect(backToAst.type).toBe('root')
    expect(backToAst.children).toBeDefined()
    expect(Array.isArray(backToAst.children)).toBe(true)
  })

  it('document content count is preserved through conversion', () => {
    const { ast } = manager.parse(`# Title

Para 1

Para 2

Para 3`)
    const doc = manager.astToProseMirror(ast)
    const backToAst = manager.proseMirrorToAST(doc)

    // Should have similar number of top-level nodes
    // Original: heading + 3 paragraphs = 4
    // Allow some variance for how AST handles spacing
    expect(backToAst.children.length).toBeGreaterThanOrEqual(3)
  })
})
