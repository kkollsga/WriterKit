import { describe, it, expect, beforeEach } from 'vitest'
import { YAMLStringifier, yamlStringifier } from './YAMLStringifier'
import { YAMLParser } from './YAMLParser'

describe('YAMLStringifier', () => {
  let stringifier: YAMLStringifier
  let parser: YAMLParser

  beforeEach(() => {
    stringifier = new YAMLStringifier()
    parser = new YAMLParser()
  })

  describe('stringify', () => {
    it('stringifies simple key-value pairs', () => {
      const data = { title: 'My Document', author: 'John Doe' }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('title: My Document')
      expect(yaml).toContain('author: John Doe')
    })

    it('stringifies numbers', () => {
      const data = { count: 42, price: 19.99, negative: -5 }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('count: 42')
      expect(yaml).toContain('price: 19.99')
      expect(yaml).toContain('negative: -5')
    })

    it('stringifies booleans', () => {
      const data = { enabled: true, disabled: false }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('enabled: true')
      expect(yaml).toContain('disabled: false')
    })

    it('stringifies null values', () => {
      const data = { empty: null }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('empty:')
    })

    it('stringifies nested objects', () => {
      const data = {
        margins: {
          top: 72,
          right: 72,
          bottom: 72,
          left: 72,
        },
      }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('margins:')
      expect(yaml).toContain('  top: 72')
      expect(yaml).toContain('  right: 72')
      expect(yaml).toContain('  bottom: 72')
      expect(yaml).toContain('  left: 72')
    })

    it('stringifies deeply nested objects', () => {
      const data = {
        config: {
          pagination: {
            pageSize: 'a4',
            margins: {
              top: 72,
            },
          },
        },
      }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('config:')
      expect(yaml).toContain('  pagination:')
      expect(yaml).toContain('    pageSize: a4')
      expect(yaml).toContain('    margins:')
      expect(yaml).toContain('      top: 72')
    })

    it('handles empty objects', () => {
      expect(stringifier.stringify({})).toBe('')
    })

    it('skips undefined values', () => {
      const data = { title: 'Test', author: undefined }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('title: Test')
      expect(yaml).not.toContain('author')
    })

    it('quotes strings with special characters', () => {
      const data = { url: 'https://example.com', time: '10:30:00' }
      const yaml = stringifier.stringify(data)

      // Should quote strings with colons
      expect(yaml).toContain('"https://example.com"')
      expect(yaml).toContain('"10:30:00"')
    })

    it('quotes strings that look like booleans', () => {
      const data = { answer: 'true', status: 'false' }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('"true"')
      expect(yaml).toContain('"false"')
    })

    it('quotes strings that look like numbers', () => {
      const data = { zipcode: '00123' }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('"00123"')
    })

    it('quotes strings with leading/trailing whitespace', () => {
      const data = { padded: '  value  ' }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('"  value  "')
    })

    it('escapes special characters in quoted strings', () => {
      const data = { text: 'Line 1\nLine 2' }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('\\n')
    })
  })

  describe('stringifyWithContent', () => {
    it('creates valid frontmatter format', () => {
      const data = { title: 'My Doc' }
      const content = 'Body content here.'
      const result = stringifier.stringifyWithContent(data, content)

      expect(result).toMatch(/^---\n/)
      expect(result).toContain('title: My Doc')
      expect(result).toContain('\n---\n')
      expect(result).toContain('Body content here.')
    })

    it('handles empty data', () => {
      const result = stringifier.stringifyWithContent({}, 'Just content')

      expect(result).toBe('Just content')
      expect(result).not.toContain('---')
    })

    it('handles empty content', () => {
      const data = { title: 'Test' }
      const result = stringifier.stringifyWithContent(data, '')

      expect(result).toContain('---')
      expect(result).toContain('title: Test')
    })

    it('preserves content formatting', () => {
      const data = { title: 'Test' }
      const content = `# Heading

Paragraph with **bold**.

- Item 1
- Item 2`
      const result = stringifier.stringifyWithContent(data, content)

      expect(result).toContain('# Heading')
      expect(result).toContain('**bold**')
      expect(result).toContain('- Item 1')
    })
  })

  describe('roundtrip', () => {
    it('roundtrips simple data', () => {
      const original = {
        title: 'My Document',
        author: 'John Doe',
        count: 42,
        enabled: true,
      }

      const yaml = stringifier.stringify(original)
      const parsed = parser.parse(yaml)

      expect(parsed.title).toBe(original.title)
      expect(parsed.author).toBe(original.author)
      expect(parsed.count).toBe(original.count)
      expect(parsed.enabled).toBe(original.enabled)
    })

    it('roundtrips nested objects', () => {
      const original = {
        title: 'Test',
        margins: {
          top: 72,
          right: 72,
          bottom: 72,
          left: 72,
        },
      }

      const yaml = stringifier.stringify(original)
      const parsed = parser.parse(yaml)

      expect(parsed.title).toBe(original.title)
      expect(parsed.margins).toEqual(original.margins)
    })

    it('roundtrips document metadata', () => {
      const original = {
        title: 'Roundtrip Test',
        author: 'Test Author',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-02T00:00:00Z',
        pageSize: 'letter',
        orientation: 'landscape',
        margins: {
          top: 54,
          right: 54,
          bottom: 54,
          left: 54,
        },
        header: {
          center: '{{title}}',
          showOnFirstPage: false,
        },
      }

      const yaml = stringifier.stringify(original)
      const parsed = parser.parse(yaml)

      expect(parsed.title).toBe(original.title)
      expect(parsed.author).toBe(original.author)
      expect(parsed.pageSize).toBe(original.pageSize)
      expect(parsed.margins).toEqual(original.margins)
      expect(parsed.header).toEqual(original.header)
    })

    it('roundtrips full frontmatter with content', () => {
      const original = {
        title: 'Full Roundtrip',
        pageSize: 'a4',
      }
      const originalContent = '# Heading\n\nContent.'

      const markdown = stringifier.stringifyWithContent(original, originalContent)
      const { data, content } = parser.extractFrontmatter(markdown)

      expect(data.title).toBe(original.title)
      expect(data.pageSize).toBe(original.pageSize)
      expect(content.trim()).toBe(originalContent)
    })
  })

  describe('browser compatibility', () => {
    it('works without Buffer global', () => {
      const data = {
        title: 'Test',
        count: 42,
        enabled: true,
        margins: { top: 72 },
      }

      // Should not throw even without Buffer
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('title: Test')
      expect(yaml).toContain('count: 42')
      expect(yaml).toContain('enabled: true')
      expect(yaml).toContain('margins:')
    })

    it('uses only standard JavaScript APIs', () => {
      const data = { test: 'value' }
      const yaml = stringifier.stringify(data)

      expect(typeof yaml).toBe('string')
      expect(yaml.length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('handles unicode characters', () => {
      const data = {
        title: '日本語タイトル',
        author: 'Jöhn Döe',
        emoji: '🎉',
      }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('日本語タイトル')
      expect(yaml).toContain('Jöhn Döe')
      expect(yaml).toContain('🎉')
    })

    it('handles very long strings', () => {
      const longString = 'a'.repeat(1000)
      const data = { long: longString }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain(longString)
    })

    it('handles empty strings', () => {
      const data = { empty: '' }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('empty:')
    })

    it('handles mixed types', () => {
      const data = {
        string: 'text',
        number: 42,
        float: 3.14,
        boolean: true,
        nothing: null,
        object: { nested: 'value' },
      }
      const yaml = stringifier.stringify(data)

      expect(yaml).toContain('string: text')
      expect(yaml).toContain('number: 42')
      expect(yaml).toContain('float: 3.14')
      expect(yaml).toContain('boolean: true')
      expect(yaml).toContain('nothing:')
      expect(yaml).toContain('object:')
      expect(yaml).toContain('  nested: value')
    })
  })

  describe('singleton instance', () => {
    it('exports a singleton instance', () => {
      expect(yamlStringifier).toBeInstanceOf(YAMLStringifier)
    })

    it('singleton works correctly', () => {
      const yaml = yamlStringifier.stringify({ title: 'Singleton Test' })
      expect(yaml).toContain('title: Singleton Test')
    })
  })
})
