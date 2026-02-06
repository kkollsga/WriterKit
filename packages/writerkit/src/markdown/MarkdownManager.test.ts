import { describe, it, expect, beforeEach } from 'vitest'
import { MarkdownManager, markdownManager, frontmatter } from './MarkdownManager'
import type { JSONContent, DocumentMetadata } from '../core'

describe('MarkdownManager', () => {
  let manager: MarkdownManager

  beforeEach(() => {
    manager = new MarkdownManager()
  })

  describe('parse', () => {
    it('parses markdown with frontmatter into AST and metadata', () => {
      const markdown = `---
title: Test Document
author: Test Author
pageSize: letter
---

# Heading

This is a paragraph.`

      const { metadata, ast, body } = manager.parse(markdown)

      expect(metadata.title).toBe('Test Document')
      expect(metadata.author).toBe('Test Author')
      expect(metadata.pageSize).toBe('letter')
      expect(ast.type).toBe('root')
      expect(ast.children.length).toBeGreaterThan(0)
      expect(body).toContain('# Heading')
    })

    it('parses markdown without frontmatter', () => {
      const markdown = `# Just a Heading

Some content.`

      const { metadata, ast } = manager.parse(markdown)

      expect(metadata.title).toBe('Untitled')
      expect(ast.children.length).toBe(2) // heading + paragraph
    })

    it('converts page break comments by default', () => {
      const markdown = `Paragraph 1.

<!-- page-break -->

Paragraph 2.`

      const { ast } = manager.parse(markdown)

      const pageBreak = ast.children.find((n) => n.type === 'pageBreak')
      expect(pageBreak).toBeDefined()
    })

    it('preserves page break comments when convertPageBreaks is false', () => {
      const markdown = `Paragraph 1.

<!-- page-break -->

Paragraph 2.`

      const { ast } = manager.parse(markdown, { convertPageBreaks: false })

      const pageBreak = ast.children.find((n) => n.type === 'pageBreak')
      const html = ast.children.find(
        (n) => n.type === 'html' && (n as { value: string }).value.includes('page-break')
      )

      expect(pageBreak).toBeUndefined()
      expect(html).toBeDefined()
    })
  })

  describe('serialize', () => {
    it('serializes ProseMirror JSON with metadata to markdown', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'My Heading' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Content here.' }],
          },
        ],
      }

      const metadata: DocumentMetadata = {
        title: 'Test Doc',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-02T00:00:00Z',
        pageSize: 'a4',
        orientation: 'portrait',
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
      }

      const { markdown, frontmatter: fm, body } = manager.serialize(doc, metadata)

      expect(markdown).toContain('title: Test Doc')
      expect(markdown).toContain('# My Heading')
      expect(markdown).toContain('Content here.')
      expect(fm).toContain('title: Test Doc')
      expect(body).toContain('# My Heading')
    })

    it('serializes without frontmatter when includeFrontmatter is false', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Just content.' }],
          },
        ],
      }

      const metadata = manager.getDefaultMetadata()

      const { markdown, frontmatter: fm } = manager.serialize(doc, metadata, {
        includeFrontmatter: false,
      })

      expect(fm).toBe('')
      expect(markdown).not.toContain('---')
      expect(markdown).toContain('Just content.')
    })

    it('serializes with minimal frontmatter', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Content.' }],
          },
        ],
      }

      const metadata: DocumentMetadata = {
        title: 'Untitled', // Default
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-02T00:00:00Z',
      }

      const { markdown } = manager.serialize(doc, metadata, {
        minimalFrontmatter: true,
      })

      // Should not include default title
      expect(markdown).not.toContain('title:')
      // Should include timestamps
      expect(markdown).toContain('createdAt:')
      expect(markdown).toContain('modifiedAt:')
    })

    it('converts page breaks to HTML comments', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Before break.' }],
          },
          { type: 'pageBreak' },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'After break.' }],
          },
        ],
      }

      const metadata = manager.getDefaultMetadata()
      const { body } = manager.serialize(doc, metadata)

      expect(body).toContain('<!-- page-break -->')
    })
  })

  describe('astToProseMirror', () => {
    it('converts mdast AST to ProseMirror JSON', () => {
      const { ast } = manager.parse('# Heading\n\nParagraph.')

      const doc = manager.astToProseMirror(ast)

      expect(doc.type).toBe('doc')
      expect(doc.content?.[0].type).toBe('heading')
      expect(doc.content?.[1].type).toBe('paragraph')
    })
  })

  describe('proseMirrorToAST', () => {
    it('converts ProseMirror JSON to mdast AST', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      }

      const ast = manager.proseMirrorToAST(doc)

      expect(ast.type).toBe('root')
      expect(ast.children[0].type).toBe('paragraph')
    })
  })

  describe('markdownToProseMirror', () => {
    it('converts markdown directly to ProseMirror JSON', () => {
      const markdown = `---
title: Direct Test
---

# Heading

Content.`

      const { doc, metadata } = manager.markdownToProseMirror(markdown)

      expect(metadata.title).toBe('Direct Test')
      expect(doc.type).toBe('doc')
      expect(doc.content?.[0].type).toBe('heading')
    })
  })

  describe('proseMirrorToMarkdown', () => {
    it('converts ProseMirror JSON directly to markdown', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }],
          },
        ],
      }

      const metadata: DocumentMetadata = {
        title: 'My Doc',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-02T00:00:00Z',
        pageSize: 'a4',
        orientation: 'portrait',
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
      }

      const markdown = manager.proseMirrorToMarkdown(doc, metadata)

      expect(markdown).toContain('title: My Doc')
      expect(markdown).toContain('# Title')
    })
  })

  describe('getDefaultMetadata', () => {
    it('returns default metadata', () => {
      const defaults = manager.getDefaultMetadata()

      expect(defaults.title).toBe('Untitled')
      expect(defaults.createdAt).toBeDefined()
      expect(defaults.modifiedAt).toBeDefined()
    })
  })

  describe('updateModifiedAt', () => {
    it('updates the modification timestamp', () => {
      const metadata: DocumentMetadata = {
        title: 'Test',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
      }

      const updated = manager.updateModifiedAt(metadata)

      expect(updated.modifiedAt).not.toBe('2025-01-01T00:00:00Z')
      expect(updated.createdAt).toBe('2025-01-01T00:00:00Z')
    })
  })

  describe('hasFrontmatter', () => {
    it('detects frontmatter in content', () => {
      expect(manager.hasFrontmatter('---\ntitle: Test\n---\nContent')).toBe(true)
      expect(manager.hasFrontmatter('Just content')).toBe(false)
    })
  })

  describe('roundtrip conversion', () => {
    it('roundtrips markdown to ProseMirror and back', () => {
      const originalMarkdown = `---
title: Roundtrip Test
author: Test Author
createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-02T00:00:00Z"
pageSize: a4
orientation: portrait
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---

# Main Heading

This is a paragraph with **bold** text.

## Subheading

- Item 1
- Item 2
- Item 3

\`\`\`javascript
const x = 1
\`\`\`

> A blockquote here.
`

      // Parse original markdown
      const { doc, metadata } = manager.markdownToProseMirror(originalMarkdown)

      // Convert back to markdown
      const resultMarkdown = manager.proseMirrorToMarkdown(doc, metadata)

      // Parse the result
      const { doc: resultDoc } = manager.markdownToProseMirror(resultMarkdown)

      // Structure should match
      expect(resultDoc.content?.length).toBe(doc.content?.length)

      // Check heading
      expect(resultDoc.content?.[0].type).toBe('heading')
      expect(resultDoc.content?.[0].attrs?.level).toBe(1)

      // Check paragraph with marks
      expect(resultDoc.content?.[1].type).toBe('paragraph')
    })

    it('preserves page breaks through roundtrip', () => {
      const markdown = `---
title: Page Break Test
createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-01T00:00:00Z"
pageSize: a4
orientation: portrait
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---

Page 1 content.

<!-- page-break -->

Page 2 content.
`

      const { doc, metadata } = manager.markdownToProseMirror(markdown)

      // Check page break is in the document
      const pageBreakNode = doc.content?.find((n) => n.type === 'pageBreak')
      expect(pageBreakNode).toBeDefined()

      // Roundtrip
      const resultMarkdown = manager.proseMirrorToMarkdown(doc, metadata)
      expect(resultMarkdown).toContain('<!-- page-break -->')

      // Parse again
      const { doc: resultDoc } = manager.markdownToProseMirror(resultMarkdown)
      const resultPageBreak = resultDoc.content?.find((n) => n.type === 'pageBreak')
      expect(resultPageBreak).toBeDefined()
    })

    it('preserves code blocks with language through roundtrip', () => {
      const markdown = `---
title: Code Test
createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-01T00:00:00Z"
pageSize: a4
orientation: portrait
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---

\`\`\`typescript
interface User {
  name: string
}
\`\`\`
`

      const { doc, metadata } = manager.markdownToProseMirror(markdown)

      const codeBlock = doc.content?.find((n) => n.type === 'codeBlock')
      expect(codeBlock?.attrs?.language).toBe('typescript')

      const resultMarkdown = manager.proseMirrorToMarkdown(doc, metadata)
      const { doc: resultDoc } = manager.markdownToProseMirror(resultMarkdown)

      const resultCodeBlock = resultDoc.content?.find((n) => n.type === 'codeBlock')
      expect(resultCodeBlock?.attrs?.language).toBe('typescript')
    })

    it('preserves lists through roundtrip', () => {
      const markdown = `---
title: List Test
createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-01T00:00:00Z"
pageSize: a4
orientation: portrait
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---

- Bullet 1
- Bullet 2

1. Ordered 1
2. Ordered 2
`

      const { doc, metadata } = manager.markdownToProseMirror(markdown)

      const bulletList = doc.content?.find((n) => n.type === 'bulletList')
      const orderedList = doc.content?.find((n) => n.type === 'orderedList')

      expect(bulletList).toBeDefined()
      expect(orderedList).toBeDefined()

      const resultMarkdown = manager.proseMirrorToMarkdown(doc, metadata)
      const { doc: resultDoc } = manager.markdownToProseMirror(resultMarkdown)

      const resultBulletList = resultDoc.content?.find((n) => n.type === 'bulletList')
      const resultOrderedList = resultDoc.content?.find((n) => n.type === 'orderedList')

      expect(resultBulletList).toBeDefined()
      expect(resultOrderedList).toBeDefined()
    })

    it('preserves blockquotes through roundtrip', () => {
      const markdown = `---
title: Quote Test
createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-01T00:00:00Z"
pageSize: a4
orientation: portrait
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---

> This is a quote.
> It spans multiple lines.
`

      const { doc, metadata } = manager.markdownToProseMirror(markdown)

      const blockquote = doc.content?.find((n) => n.type === 'blockquote')
      expect(blockquote).toBeDefined()

      const resultMarkdown = manager.proseMirrorToMarkdown(doc, metadata)
      const { doc: resultDoc } = manager.markdownToProseMirror(resultMarkdown)

      const resultBlockquote = resultDoc.content?.find((n) => n.type === 'blockquote')
      expect(resultBlockquote).toBeDefined()
    })
  })

  describe('singleton exports', () => {
    it('exports markdownManager singleton', () => {
      expect(markdownManager).toBeInstanceOf(MarkdownManager)
    })

    it('exports frontmatter singleton', () => {
      expect(frontmatter).toBeDefined()
      expect(typeof frontmatter.parse).toBe('function')
    })
  })
})
