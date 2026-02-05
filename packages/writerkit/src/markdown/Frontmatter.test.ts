import { describe, it, expect, beforeEach } from 'vitest'
import { Frontmatter, frontmatter } from './Frontmatter'
import type { DocumentMetadata } from '../core'

describe('Frontmatter', () => {
  let fm: Frontmatter

  beforeEach(() => {
    fm = new Frontmatter()
  })

  describe('parse', () => {
    it('parses complete frontmatter', () => {
      const content = `---
title: My Document
author: John Doe
createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-02T00:00:00Z"
pageSize: letter
orientation: landscape
margins:
  top: 36
  right: 48
  bottom: 36
  left: 48
---

Document body content.`

      const { metadata, body } = fm.parse(content)

      expect(metadata.title).toBe('My Document')
      expect(metadata.author).toBe('John Doe')
      // Date strings are preserved when quoted
      expect(metadata.createdAt).toBe('2025-01-01T00:00:00Z')
      expect(metadata.modifiedAt).toBe('2025-01-02T00:00:00Z')
      expect(metadata.pageSize).toBe('letter')
      expect(metadata.orientation).toBe('landscape')
      expect(metadata.margins).toEqual({
        top: 36,
        right: 48,
        bottom: 36,
        left: 48,
      })
      expect(body.trim()).toBe('Document body content.')
    })

    it('applies defaults for missing fields', () => {
      const content = `---
title: Simple Doc
---

Content here.`

      const { metadata } = fm.parse(content)

      expect(metadata.title).toBe('Simple Doc')
      expect(metadata.pageSize).toBe('a4')
      expect(metadata.orientation).toBe('portrait')
      expect(metadata.margins).toEqual({
        top: 72,
        right: 72,
        bottom: 72,
        left: 72,
      })
    })

    it('handles content without frontmatter', () => {
      const content = 'Just plain content without frontmatter.'

      const { metadata, body } = fm.parse(content)

      expect(metadata.title).toBe('Untitled')
      expect(body.trim()).toBe('Just plain content without frontmatter.')
    })

    it('handles empty frontmatter', () => {
      const content = `---
---

Body content.`

      const { metadata, body } = fm.parse(content)

      expect(metadata.title).toBe('Untitled')
      expect(body.trim()).toBe('Body content.')
    })

    it('parses header and footer config', () => {
      const content = `---
title: With Headers
header:
  left: "Author Name"
  center: "{{title}}"
  right: "{{date}}"
  showOnFirstPage: false
footer:
  center: "Page {{pageNumber}} of {{totalPages}}"
---

Content.`

      const { metadata } = fm.parse(content)

      expect(metadata.header).toEqual({
        left: 'Author Name',
        center: '{{title}}',
        right: '{{date}}',
        showOnFirstPage: false,
      })
      expect(metadata.footer).toEqual({
        center: 'Page {{pageNumber}} of {{totalPages}}',
        showOnFirstPage: true,
      })
    })

    it('merges partial margins with defaults', () => {
      const content = `---
title: Partial Margins
margins:
  top: 100
---

Content.`

      const { metadata } = fm.parse(content)

      expect(metadata.margins).toEqual({
        top: 100,
        right: 72,
        bottom: 72,
        left: 72,
      })
    })

    it('throws on invalid page size', () => {
      const content = `---
pageSize: tabloid
---
Content.`

      expect(() => fm.parse(content)).toThrow('Invalid page size: tabloid')
    })

    it('throws on invalid orientation', () => {
      const content = `---
orientation: sideways
---
Content.`

      expect(() => fm.parse(content)).toThrow('Invalid orientation: sideways')
    })

    it('throws on negative margins', () => {
      const content = `---
margins:
  top: -10
---
Content.`

      expect(() => fm.parse(content)).toThrow('Invalid margin.top: -10')
    })

    it('validates all supported page sizes', () => {
      const pageSizes = ['a4', 'letter', 'legal', 'a3', 'a5']

      for (const pageSize of pageSizes) {
        const content = `---
pageSize: ${pageSize}
---
Content.`

        const { metadata } = fm.parse(content)
        expect(metadata.pageSize).toBe(pageSize)
      }
    })

    it('validates both orientations', () => {
      for (const orientation of ['portrait', 'landscape']) {
        const content = `---
orientation: ${orientation}
---
Content.`

        const { metadata } = fm.parse(content)
        expect(metadata.orientation).toBe(orientation)
      }
    })
  })

  describe('serialize', () => {
    it('serializes complete metadata', () => {
      const metadata: DocumentMetadata = {
        title: 'My Document',
        author: 'John Doe',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-02T00:00:00Z',
        pageSize: 'letter',
        orientation: 'landscape',
        margins: {
          top: 36,
          right: 48,
          bottom: 36,
          left: 48,
        },
        header: {
          center: '{{title}}',
          showOnFirstPage: true,
        },
        footer: {
          center: 'Page {{pageNumber}}',
          showOnFirstPage: true,
        },
      }

      const result = fm.serialize(metadata, 'Body content.')

      expect(result).toContain('title: My Document')
      expect(result).toContain('author: John Doe')
      expect(result).toContain('pageSize: letter')
      expect(result).toContain('orientation: landscape')
      expect(result).toContain('Body content.')
    })

    it('serializes minimal frontmatter when option is set', () => {
      const metadata: DocumentMetadata = {
        title: 'Untitled', // Default value
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-02T00:00:00Z',
        pageSize: 'a4', // Default value
        orientation: 'portrait', // Default value
        margins: {
          top: 72, // Default values
          right: 72,
          bottom: 72,
          left: 72,
        },
      }

      const result = fm.serialize(metadata, 'Content.', { minimal: true })

      // Should not include default title or page settings
      expect(result).not.toContain('title:')
      expect(result).not.toContain('pageSize:')
      expect(result).not.toContain('orientation:')
      expect(result).not.toContain('margins:')
      // But should include timestamps
      expect(result).toContain('createdAt:')
      expect(result).toContain('modifiedAt:')
    })

    it('includes non-default values in minimal mode', () => {
      const metadata: DocumentMetadata = {
        title: 'Custom Title',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-02T00:00:00Z',
        pageSize: 'letter',
        orientation: 'portrait',
        margins: {
          top: 72,
          right: 72,
          bottom: 72,
          left: 72,
        },
      }

      const result = fm.serialize(metadata, 'Content.', { minimal: true })

      expect(result).toContain('title: Custom Title')
      expect(result).toContain('pageSize: letter')
    })

    it('includes author when present', () => {
      const metadata: DocumentMetadata = {
        title: 'Untitled',
        author: 'Jane Doe',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-02T00:00:00Z',
        pageSize: 'a4',
        orientation: 'portrait',
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
      }

      const result = fm.serialize(metadata, 'Content.', { minimal: true })

      expect(result).toContain('author: Jane Doe')
    })
  })

  describe('roundtrip', () => {
    it('roundtrips complete metadata', () => {
      const original: DocumentMetadata = {
        title: 'Roundtrip Test',
        author: 'Test Author',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-02T00:00:00Z',
        pageSize: 'legal',
        orientation: 'landscape',
        margins: {
          top: 54,
          right: 54,
          bottom: 54,
          left: 54,
        },
        header: {
          left: 'Left Header',
          center: 'Center',
          right: 'Right',
          showOnFirstPage: false,
        },
        footer: {
          center: 'Footer',
          showOnFirstPage: true,
        },
      }
      const originalBody = 'Document content here.'

      const serialized = fm.serialize(original, originalBody)
      const { metadata, body } = fm.parse(serialized)

      expect(metadata.title).toBe(original.title)
      expect(metadata.author).toBe(original.author)
      expect(metadata.createdAt).toBe(original.createdAt)
      expect(metadata.modifiedAt).toBe(original.modifiedAt)
      expect(metadata.pageSize).toBe(original.pageSize)
      expect(metadata.orientation).toBe(original.orientation)
      expect(metadata.margins).toEqual(original.margins)
      expect(metadata.header).toEqual(original.header)
      expect(metadata.footer).toEqual(original.footer)
      expect(body.trim()).toBe(originalBody)
    })
  })

  describe('getDefaults', () => {
    it('returns default metadata', () => {
      const defaults = fm.getDefaults()

      expect(defaults.title).toBe('Untitled')
      expect(defaults.pageSize).toBe('a4')
      expect(defaults.orientation).toBe('portrait')
      expect(defaults.margins).toEqual({
        top: 72,
        right: 72,
        bottom: 72,
        left: 72,
      })
    })

    it('returns a new object each time', () => {
      const defaults1 = fm.getDefaults()
      const defaults2 = fm.getDefaults()

      expect(defaults1).not.toBe(defaults2)
      expect(defaults1).toEqual(defaults2)
    })
  })

  describe('updateModifiedAt', () => {
    it('updates the modifiedAt timestamp', () => {
      const metadata: DocumentMetadata = {
        title: 'Test',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        pageSize: 'a4',
        orientation: 'portrait',
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
      }

      const before = new Date().toISOString()
      const updated = fm.updateModifiedAt(metadata)
      const after = new Date().toISOString()

      expect(updated.modifiedAt >= before).toBe(true)
      expect(updated.modifiedAt <= after).toBe(true)
      expect(updated.createdAt).toBe(metadata.createdAt)
    })

    it('does not mutate the original metadata', () => {
      const metadata: DocumentMetadata = {
        title: 'Test',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        pageSize: 'a4',
        orientation: 'portrait',
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
      }

      const originalModifiedAt = metadata.modifiedAt
      fm.updateModifiedAt(metadata)

      expect(metadata.modifiedAt).toBe(originalModifiedAt)
    })
  })

  describe('hasFrontmatter', () => {
    it('returns true for content with frontmatter', () => {
      expect(fm.hasFrontmatter('---\ntitle: Test\n---\nContent')).toBe(true)
    })

    it('returns true for frontmatter with leading whitespace', () => {
      expect(fm.hasFrontmatter('  ---\ntitle: Test\n---\nContent')).toBe(true)
    })

    it('returns false for content without frontmatter', () => {
      expect(fm.hasFrontmatter('Just regular content')).toBe(false)
    })

    it('returns false for content starting with dashes in body', () => {
      expect(fm.hasFrontmatter('- List item\n- Another item')).toBe(false)
    })
  })

  describe('singleton instance', () => {
    it('exports a singleton instance', () => {
      expect(frontmatter).toBeInstanceOf(Frontmatter)
    })

    it('singleton works correctly', () => {
      const content = `---
title: Singleton Test
---
Content.`

      const { metadata } = frontmatter.parse(content)
      expect(metadata.title).toBe('Singleton Test')
    })
  })
})
