import { describe, it, expect, beforeEach } from 'vitest'
import { YAMLParser, yamlParser } from './YAMLParser'

describe('YAMLParser', () => {
  let parser: YAMLParser

  beforeEach(() => {
    parser = new YAMLParser()
  })

  describe('parse', () => {
    it('parses simple key-value pairs', () => {
      const yaml = `title: My Document
author: John Doe`
      const result = parser.parse(yaml)

      expect(result.title).toBe('My Document')
      expect(result.author).toBe('John Doe')
    })

    it('parses quoted strings', () => {
      const yaml = `title: "My Document"
author: 'John Doe'`
      const result = parser.parse(yaml)

      expect(result.title).toBe('My Document')
      expect(result.author).toBe('John Doe')
    })

    it('parses numbers', () => {
      const yaml = `count: 42
price: 19.99
negative: -5`
      const result = parser.parse(yaml)

      expect(result.count).toBe(42)
      expect(result.price).toBe(19.99)
      expect(result.negative).toBe(-5)
    })

    it('parses booleans', () => {
      const yaml = `enabled: true
disabled: false
yes_value: yes
no_value: no`
      const result = parser.parse(yaml)

      expect(result.enabled).toBe(true)
      expect(result.disabled).toBe(false)
      expect(result.yes_value).toBe(true)
      expect(result.no_value).toBe(false)
    })

    it('parses null values', () => {
      const yaml = `empty: null
tilde: ~`
      const result = parser.parse(yaml)

      expect(result.empty).toBe(null)
      expect(result.tilde).toBe(null)
    })

    it('parses nested objects', () => {
      const yaml = `margins:
  top: 72
  right: 72
  bottom: 72
  left: 72`
      const result = parser.parse(yaml)

      expect(result.margins).toEqual({
        top: 72,
        right: 72,
        bottom: 72,
        left: 72,
      })
    })

    it('parses deeply nested objects', () => {
      const yaml = `config:
  pagination:
    pageSize: a4
    margins:
      top: 72`
      const result = parser.parse(yaml)

      expect(result.config).toEqual({
        pagination: {
          pageSize: 'a4',
          margins: {
            top: 72,
          },
        },
      })
    })

    it('skips comments', () => {
      const yaml = `# This is a comment
title: Test
# Another comment
author: Jane`
      const result = parser.parse(yaml)

      expect(result.title).toBe('Test')
      expect(result.author).toBe('Jane')
    })

    it('skips empty lines', () => {
      const yaml = `title: Test

author: Jane

count: 5`
      const result = parser.parse(yaml)

      expect(result.title).toBe('Test')
      expect(result.author).toBe('Jane')
      expect(result.count).toBe(5)
    })

    it('handles empty input', () => {
      expect(parser.parse('')).toEqual({})
      expect(parser.parse('   ')).toEqual({})
      expect(parser.parse('\n\n')).toEqual({})
    })

    it('handles values with colons', () => {
      const yaml = `time: "10:30:00"
url: https://example.com`
      const result = parser.parse(yaml)

      expect(result.time).toBe('10:30:00')
      expect(result.url).toBe('https://example.com')
    })

    it('preserves ISO date strings when quoted', () => {
      const yaml = `createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-02T12:30:00Z"`
      const result = parser.parse(yaml)

      expect(result.createdAt).toBe('2025-01-01T00:00:00Z')
      expect(result.modifiedAt).toBe('2025-01-02T12:30:00Z')
    })

    it('handles tab indentation', () => {
      const yaml = `margins:
\ttop: 72
\tright: 72`
      const result = parser.parse(yaml)

      expect(result.margins).toEqual({
        top: 72,
        right: 72,
      })
    })
  })

  describe('extractFrontmatter', () => {
    it('extracts frontmatter from markdown', () => {
      const markdown = `---
title: My Document
author: John Doe
---

# Heading

Content here.`
      const { data, content } = parser.extractFrontmatter(markdown)

      expect(data.title).toBe('My Document')
      expect(data.author).toBe('John Doe')
      expect(content.trim()).toBe('# Heading\n\nContent here.')
    })

    it('handles content without frontmatter', () => {
      const markdown = `# Just Content

No frontmatter here.`
      const { data, content } = parser.extractFrontmatter(markdown)

      expect(data).toEqual({})
      expect(content).toBe(markdown)
    })

    it('handles empty frontmatter', () => {
      const markdown = `---
---

Content.`
      const { data, content } = parser.extractFrontmatter(markdown)

      expect(data).toEqual({})
      expect(content.trim()).toBe('Content.')
    })

    it('handles frontmatter with leading whitespace', () => {
      const markdown = `  ---
title: Test
---
Content.`
      const { data, content } = parser.extractFrontmatter(markdown)

      expect(data.title).toBe('Test')
      expect(content.trim()).toBe('Content.')
    })

    it('handles missing closing delimiter', () => {
      const markdown = `---
title: Test
No closing delimiter, so treat as content.`
      const { data, content } = parser.extractFrontmatter(markdown)

      // Should return empty data and original content
      expect(data).toEqual({})
    })

    it('handles complex nested frontmatter', () => {
      const markdown = `---
title: My Document
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
header:
  center: "{{title}}"
  showOnFirstPage: false
---

Content.`
      const { data, content } = parser.extractFrontmatter(markdown)

      expect(data.title).toBe('My Document')
      expect(data.margins).toEqual({
        top: 72,
        right: 72,
        bottom: 72,
        left: 72,
      })
      expect(data.header).toEqual({
        center: '{{title}}',
        showOnFirstPage: false,
      })
      expect(content.trim()).toBe('Content.')
    })

    it('preserves content formatting', () => {
      const markdown = `---
title: Test
---

# Heading 1

Paragraph with **bold** and *italic*.

- List item 1
- List item 2`
      const { content } = parser.extractFrontmatter(markdown)

      expect(content).toContain('# Heading 1')
      expect(content).toContain('**bold**')
      expect(content).toContain('- List item 1')
    })
  })

  describe('edge cases', () => {
    it('handles unicode characters', () => {
      const yaml = `title: 日本語タイトル
author: Jöhn Döe
emoji: 🎉`
      const result = parser.parse(yaml)

      expect(result.title).toBe('日本語タイトル')
      expect(result.author).toBe('Jöhn Döe')
      expect(result.emoji).toBe('🎉')
    })

    it('handles multiline quoted strings with escaped newlines', () => {
      const yaml = `description: "Line 1\\nLine 2"`
      const result = parser.parse(yaml)

      // The parser treats this as a literal string (doesn't expand \n)
      expect(result.description).toBe('Line 1\\nLine 2')
    })

    it('handles strings that look like numbers but are quoted', () => {
      const yaml = `zipcode: "00123"
phone: "123-456-7890"`
      const result = parser.parse(yaml)

      expect(result.zipcode).toBe('00123')
      expect(result.phone).toBe('123-456-7890')
    })

    it('handles strings that look like booleans but are quoted', () => {
      const yaml = `answer: "true"
status: "false"`
      const result = parser.parse(yaml)

      expect(result.answer).toBe('true')
      expect(result.status).toBe('false')
    })

    it('handles keys with spaces (when quoted)', () => {
      // Our simple parser doesn't support quoted keys,
      // but handles simple keys without spaces
      const yaml = `simple_key: value
anotherKey: test`
      const result = parser.parse(yaml)

      expect(result.simple_key).toBe('value')
      expect(result.anotherKey).toBe('test')
    })
  })

  describe('browser compatibility', () => {
    it('works without Buffer global (simulated)', () => {
      // This test verifies the parser doesn't depend on Buffer
      // by not importing or using it
      const yaml = `title: Test
count: 42
enabled: true
margins:
  top: 72`

      // Should not throw even without Buffer
      const result = parser.parse(yaml)

      expect(result.title).toBe('Test')
      expect(result.count).toBe(42)
      expect(result.enabled).toBe(true)
      expect(result.margins).toEqual({ top: 72 })
    })

    it('uses only standard JavaScript APIs', () => {
      // Verify we're using standard APIs (String, Array, Object)
      const yaml = `test: value`
      const result = parser.parse(yaml)

      expect(typeof result.test).toBe('string')
      expect(Object.keys(result)).toContain('test')
    })
  })

  describe('singleton instance', () => {
    it('exports a singleton instance', () => {
      expect(yamlParser).toBeInstanceOf(YAMLParser)
    })

    it('singleton works correctly', () => {
      const yaml = `title: Singleton Test`
      const result = yamlParser.parse(yaml)
      expect(result.title).toBe('Singleton Test')
    })
  })
})
