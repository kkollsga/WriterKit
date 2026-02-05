import { describe, it, expect } from 'vitest'
import { ASTConverter } from './ASTConverter'
import type { WriterKitRoot } from './types'
import type { JSONContent } from '../core'

describe('ASTConverter', () => {
  const converter = new ASTConverter()

  describe('mdast → ProseMirror', () => {
    it('converts a simple paragraph', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'Hello, world!' }],
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result).toEqual({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello, world!' }],
          },
        ],
      })
    })

    it('converts headings with correct levels', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'heading',
            depth: 1,
            children: [{ type: 'text', value: 'Title' }],
          },
          {
            type: 'heading',
            depth: 2,
            children: [{ type: 'text', value: 'Subtitle' }],
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content).toHaveLength(2)
      expect(result.content?.[0]).toEqual({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Title' }],
      })
      expect(result.content?.[1]).toEqual({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Subtitle' }],
      })
    })

    it('converts bold text with marks', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
            ],
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0].content?.[0]).toEqual({
        type: 'text',
        text: 'bold',
        marks: [{ type: 'bold' }],
      })
    })

    it('converts italic text with marks', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'emphasis', children: [{ type: 'text', value: 'italic' }] },
            ],
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0].content?.[0]).toEqual({
        type: 'text',
        text: 'italic',
        marks: [{ type: 'italic' }],
      })
    })

    it('converts nested bold and italic', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'strong',
                children: [
                  {
                    type: 'emphasis',
                    children: [{ type: 'text', value: 'bold italic' }],
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = converter.toProseMirror(ast)
      const textNode = result.content?.[0].content?.[0]

      expect(textNode?.text).toBe('bold italic')
      expect(textNode?.marks).toContainEqual({ type: 'bold' })
      expect(textNode?.marks).toContainEqual({ type: 'italic' })
    })

    it('converts inline code', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'inlineCode', value: 'const x = 1' }],
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0].content?.[0]).toEqual({
        type: 'text',
        text: 'const x = 1',
        marks: [{ type: 'code' }],
      })
    })

    it('converts code blocks with language', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'code',
            lang: 'typescript',
            value: 'const x: number = 1',
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0]).toEqual({
        type: 'codeBlock',
        attrs: { language: 'typescript' },
        content: [{ type: 'text', text: 'const x: number = 1' }],
      })
    })

    it('converts blockquotes', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'blockquote',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'A quote' }],
              },
            ],
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0]).toEqual({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'A quote' }],
          },
        ],
      })
    })

    it('converts bullet lists', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'list',
            ordered: false,
            children: [
              {
                type: 'listItem',
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', value: 'Item 1' }],
                  },
                ],
              },
              {
                type: 'listItem',
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', value: 'Item 2' }],
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0].type).toBe('bulletList')
      expect(result.content?.[0].content).toHaveLength(2)
    })

    it('converts ordered lists with start number', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'list',
            ordered: true,
            start: 5,
            children: [
              {
                type: 'listItem',
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', value: 'Item 5' }],
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0].type).toBe('orderedList')
      expect(result.content?.[0].attrs).toEqual({ start: 5 })
    })

    it('converts links', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'https://example.com',
                title: 'Example',
                children: [{ type: 'text', value: 'Click here' }],
              },
            ],
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0].content?.[0]).toEqual({
        type: 'text',
        text: 'Click here',
        marks: [
          {
            type: 'link',
            attrs: { href: 'https://example.com', title: 'Example' },
          },
        ],
      })
    })

    it('converts images', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'image',
            url: 'image.png',
            alt: 'An image',
            title: 'Image title',
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0]).toEqual({
        type: 'image',
        attrs: {
          src: 'image.png',
          alt: 'An image',
          title: 'Image title',
        },
      })
    })

    it('converts horizontal rules', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [{ type: 'thematicBreak' }],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0]).toEqual({ type: 'horizontalRule' })
    })

    it('converts hard breaks', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'Line 1' },
              { type: 'break' },
              { type: 'text', value: 'Line 2' },
            ],
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0].content).toEqual([
        { type: 'text', text: 'Line 1' },
        { type: 'hardBreak' },
        { type: 'text', text: 'Line 2' },
      ])
    })

    it('converts page break HTML comments', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [{ type: 'html', value: '<!-- page-break -->' }],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0]).toEqual({ type: 'pageBreak' })
    })

    it('converts page break nodes', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [{ type: 'pageBreak' }],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0]).toEqual({ type: 'pageBreak' })
    })

    it('converts tables', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'table',
            children: [
              {
                type: 'tableRow',
                children: [
                  {
                    type: 'tableCell',
                    children: [
                      {
                        type: 'paragraph',
                        children: [{ type: 'text', value: 'Cell 1' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    children: [
                      {
                        type: 'paragraph',
                        children: [{ type: 'text', value: 'Cell 2' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0].type).toBe('table')
      expect(result.content?.[0].content?.[0].type).toBe('tableRow')
      expect(result.content?.[0].content?.[0].content?.[0].type).toBe('tableCell')
    })
  })

  describe('ProseMirror → mdast', () => {
    it('converts a simple paragraph', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello, world!' }],
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result).toEqual({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'Hello, world!' }],
          },
        ],
      })
    })

    it('converts headings', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Title' }],
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toEqual({
        type: 'heading',
        depth: 2,
        children: [{ type: 'text', value: 'Title' }],
      })
    })

    it('converts bold marks to strong', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'bold',
                marks: [{ type: 'bold' }],
              },
            ],
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toEqual({
        type: 'paragraph',
        children: [
          {
            type: 'strong',
            children: [{ type: 'text', value: 'bold' }],
          },
        ],
      })
    })

    it('converts italic marks to emphasis', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'italic',
                marks: [{ type: 'italic' }],
              },
            ],
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toEqual({
        type: 'paragraph',
        children: [
          {
            type: 'emphasis',
            children: [{ type: 'text', value: 'italic' }],
          },
        ],
      })
    })

    it('converts code marks to inlineCode', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'const x = 1',
                marks: [{ type: 'code' }],
              },
            ],
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toEqual({
        type: 'paragraph',
        children: [{ type: 'inlineCode', value: 'const x = 1' }],
      })
    })

    it('converts code blocks', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'console.log("hi")' }],
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toEqual({
        type: 'code',
        lang: 'javascript',
        value: 'console.log("hi")',
      })
    })

    it('converts blockquotes', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'A quote' }],
              },
            ],
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toEqual({
        type: 'blockquote',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'A quote' }],
          },
        ],
      })
    })

    it('converts bullet lists', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Item' }],
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toMatchObject({
        type: 'list',
        ordered: false,
      })
    })

    it('converts ordered lists', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            attrs: { start: 3 },
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Item' }],
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toMatchObject({
        type: 'list',
        ordered: true,
        start: 3,
      })
    })

    it('converts link marks', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Click here',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'https://example.com', title: 'Example' },
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toEqual({
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            title: 'Example',
            children: [{ type: 'text', value: 'Click here' }],
          },
        ],
      })
    })

    it('converts images', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: { src: 'image.png', alt: 'Alt text', title: 'Title' },
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toEqual({
        type: 'image',
        url: 'image.png',
        alt: 'Alt text',
        title: 'Title',
      })
    })

    it('converts horizontal rules', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [{ type: 'horizontalRule' }],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toEqual({ type: 'thematicBreak' })
    })

    it('converts hard breaks', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Line 1' },
              { type: 'hardBreak' },
              { type: 'text', text: 'Line 2' },
            ],
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toEqual({
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Line 1' },
          { type: 'break' },
          { type: 'text', value: 'Line 2' },
        ],
      })
    })

    it('converts page breaks to HTML comments', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [{ type: 'pageBreak' }],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toEqual({
        type: 'html',
        value: '<!-- page-break -->',
      })
    })

    it('converts tables', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Cell' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = converter.toMdast(doc)

      expect(result.children[0]).toMatchObject({
        type: 'table',
        children: [
          {
            type: 'tableRow',
            children: [
              {
                type: 'tableCell',
              },
            ],
          },
        ],
      })
    })
  })

  describe('roundtrip conversion', () => {
    it('roundtrips a simple paragraph', () => {
      const original: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello, world!' }],
          },
        ],
      }

      const ast = converter.toMdast(original)
      const result = converter.toProseMirror(ast)

      expect(result).toEqual(original)
    })

    it('roundtrips headings', () => {
      const original: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'My Heading' }],
          },
        ],
      }

      const ast = converter.toMdast(original)
      const result = converter.toProseMirror(ast)

      expect(result).toEqual(original)
    })

    it('roundtrips code blocks', () => {
      const original: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'python' },
            content: [{ type: 'text', text: 'print("hello")' }],
          },
        ],
      }

      const ast = converter.toMdast(original)
      const result = converter.toProseMirror(ast)

      expect(result).toEqual(original)
    })

    it('roundtrips page breaks', () => {
      const original: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Before' }],
          },
          { type: 'pageBreak' },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'After' }],
          },
        ],
      }

      const ast = converter.toMdast(original)
      const result = converter.toProseMirror(ast)

      expect(result).toEqual(original)
    })

    it('roundtrips complex documents', () => {
      const original: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Introduction' }],
          },
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'A quote' }],
              },
            ],
          },
          { type: 'horizontalRule' },
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'const x = 1' }],
          },
        ],
      }

      const ast = converter.toMdast(original)
      const result = converter.toProseMirror(ast)

      expect(result).toEqual(original)
    })
  })

  describe('edge cases', () => {
    it('handles empty documents', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [],
      }

      const result = converter.toProseMirror(ast)

      expect(result).toEqual({ type: 'doc', content: [] })
    })

    it('handles empty paragraphs', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [{ type: 'paragraph', children: [] }],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0]).toEqual({
        type: 'paragraph',
        content: [],
      })
    })

    it('handles code block without language', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [{ type: 'code', value: 'plain code' }],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0]).toEqual({
        type: 'codeBlock',
        attrs: { language: null },
        content: [{ type: 'text', text: 'plain code' }],
      })
    })

    it('handles link without title', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'https://example.com',
                children: [{ type: 'text', value: 'Link' }],
              },
            ],
          },
        ],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0].content?.[0].marks?.[0]).toEqual({
        type: 'link',
        attrs: { href: 'https://example.com', title: null },
      })
    })

    it('handles image without alt or title', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [{ type: 'image', url: 'image.png' }],
      }

      const result = converter.toProseMirror(ast)

      expect(result.content?.[0]).toEqual({
        type: 'image',
        attrs: { src: 'image.png', alt: null, title: null },
      })
    })

    it('preserves unknown nodes when configured', () => {
      const converterWithPreserve = new ASTConverter({ preserveUnknown: true })
      const ast: WriterKitRoot = {
        type: 'root',
        children: [{ type: 'footnote' as 'paragraph' }], // Unknown type
      }

      const result = converterWithPreserve.toProseMirror(ast)

      expect(result.content?.[0]).toEqual({
        type: 'unknown',
        attrs: { originalType: 'footnote' },
      })
    })

    it('skips unknown nodes by default', () => {
      const ast: WriterKitRoot = {
        type: 'root',
        children: [{ type: 'footnote' as 'paragraph' }], // Unknown type
      }

      const result = converter.toProseMirror(ast)

      expect(result.content).toEqual([])
    })
  })
})
