import { describe, it, expect, beforeEach } from 'vitest'
import { Schema } from 'prosemirror-model'
import { Measurer } from './Measurer'
import { DEFAULT_PAGINATION_CONFIG, createPageDimensions } from './types'

// Create a simple schema for testing
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      toDOM() {
        return ['p', 0]
      },
    },
    heading: {
      group: 'block',
      attrs: { level: { default: 1 } },
      content: 'inline*',
      toDOM(node) {
        return ['h' + node.attrs.level, 0]
      },
    },
    codeBlock: {
      group: 'block',
      content: 'text*',
      attrs: { language: { default: null } },
      toDOM() {
        return ['pre', ['code', 0]]
      },
    },
    blockquote: {
      group: 'block',
      content: 'block+',
      toDOM() {
        return ['blockquote', 0]
      },
    },
    bulletList: {
      group: 'block',
      content: 'listItem+',
      toDOM() {
        return ['ul', 0]
      },
    },
    orderedList: {
      group: 'block',
      content: 'listItem+',
      attrs: { start: { default: 1 } },
      toDOM() {
        return ['ol', 0]
      },
    },
    listItem: {
      content: 'paragraph block*',
      toDOM() {
        return ['li', 0]
      },
    },
    horizontalRule: {
      group: 'block',
      toDOM() {
        return ['hr']
      },
    },
    pageBreak: {
      group: 'block',
      toDOM() {
        return ['div', { class: 'page-break' }]
      },
    },
    text: { group: 'inline' },
  },
})

describe('Measurer', () => {
  let measurer: Measurer

  beforeEach(() => {
    const dimensions = createPageDimensions(DEFAULT_PAGINATION_CONFIG)
    measurer = new Measurer(DEFAULT_PAGINATION_CONFIG, dimensions)
  })

  describe('estimateNodeHeight', () => {
    it('estimates paragraph height based on text length', () => {
      const shortParagraph = schema.nodes.paragraph.create(
        null,
        schema.text('Short text')
      )
      const longParagraph = schema.nodes.paragraph.create(
        null,
        schema.text('A'.repeat(500))
      )

      const shortHeight = measurer.estimateNodeHeight(shortParagraph)
      const longHeight = measurer.estimateNodeHeight(longParagraph)

      expect(shortHeight).toBeGreaterThan(0)
      expect(longHeight).toBeGreaterThan(shortHeight)
    })

    it('estimates heading height with proper scaling', () => {
      const h1 = schema.nodes.heading.create(
        { level: 1 },
        schema.text('Heading 1')
      )
      const h3 = schema.nodes.heading.create(
        { level: 3 },
        schema.text('Heading 3')
      )

      const h1Height = measurer.estimateNodeHeight(h1)
      const h3Height = measurer.estimateNodeHeight(h3)

      // H1 should be taller than H3
      expect(h1Height).toBeGreaterThan(h3Height)
    })

    it('estimates code block height based on lines', () => {
      const singleLine = schema.nodes.codeBlock.create(
        null,
        schema.text('const x = 1')
      )
      const multiLine = schema.nodes.codeBlock.create(
        null,
        schema.text('const x = 1\nconst y = 2\nconst z = 3')
      )

      const singleHeight = measurer.estimateNodeHeight(singleLine)
      const multiHeight = measurer.estimateNodeHeight(multiLine)

      expect(multiHeight).toBeGreaterThan(singleHeight)
    })

    it('estimates horizontal rule with fixed height', () => {
      const hr = schema.nodes.horizontalRule.create()
      const height = measurer.estimateNodeHeight(hr)

      expect(height).toBe(20)
    })

    it('returns 0 for page breaks', () => {
      const pageBreak = schema.nodes.pageBreak.create()
      const height = measurer.estimateNodeHeight(pageBreak)

      expect(height).toBe(0)
    })

    it('estimates list height based on items', () => {
      const listItem1 = schema.nodes.listItem.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Item 1')),
      ])
      const listItem2 = schema.nodes.listItem.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Item 2')),
      ])
      const bulletList = schema.nodes.bulletList.create(null, [
        listItem1,
        listItem2,
      ])

      const height = measurer.estimateNodeHeight(bulletList)

      expect(height).toBeGreaterThan(0)
    })

    it('estimates blockquote height including children', () => {
      const para = schema.nodes.paragraph.create(
        null,
        schema.text('Quoted text')
      )
      const blockquote = schema.nodes.blockquote.create(null, [para])

      const paraHeight = measurer.estimateNodeHeight(para)
      const quoteHeight = measurer.estimateNodeHeight(blockquote)

      // Blockquote should be taller due to padding
      expect(quoteHeight).toBeGreaterThan(paraHeight)
    })
  })

  describe('measureNode', () => {
    it('returns measurement with position and type', () => {
      const para = schema.nodes.paragraph.create(
        null,
        schema.text('Test paragraph')
      )

      const measurement = measurer.measureNode(para, 1)

      expect(measurement.pos).toBe(1)
      expect(measurement.type).toBe('paragraph')
      expect(measurement.height).toBeGreaterThan(0)
      expect(measurement.splittable).toBe(false)
    })

    it('marks page breaks with zero height', () => {
      const pageBreak = schema.nodes.pageBreak.create()

      const measurement = measurer.measureNode(pageBreak, 5)

      expect(measurement.type).toBe('pageBreak')
      expect(measurement.height).toBe(0)
      expect(measurement.splittable).toBe(false)
    })

    it('marks lists as splittable', () => {
      const listItem = schema.nodes.listItem.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Item')),
      ])
      const bulletList = schema.nodes.bulletList.create(null, [listItem])

      const measurement = measurer.measureNode(bulletList, 1)

      expect(measurement.splittable).toBe(true)
      expect(measurement.itemHeights).toBeDefined()
    })
  })

  describe('measureDocument', () => {
    it('measures all top-level blocks', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.heading.create({ level: 1 }, schema.text('Title')),
        schema.nodes.paragraph.create(null, schema.text('Content')),
        schema.nodes.horizontalRule.create(),
      ])

      const measurements = measurer.measureDocument(doc)

      expect(measurements).toHaveLength(3)
      expect(measurements[0].type).toBe('heading')
      expect(measurements[1].type).toBe('paragraph')
      expect(measurements[2].type).toBe('horizontalRule')
    })

    it('assigns sequential positions', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Para 1')),
        schema.nodes.paragraph.create(null, schema.text('Para 2')),
      ])

      const measurements = measurer.measureDocument(doc)

      expect(measurements[0].pos).toBe(1)
      expect(measurements[1].pos).toBeGreaterThan(measurements[0].pos)
    })
  })

  describe('caching', () => {
    it('caches measurements', () => {
      const para = schema.nodes.paragraph.create(
        null,
        schema.text('Cached content')
      )

      // First measurement
      const m1 = measurer.measureNode(para, 1)

      // Second measurement should use cache
      const m2 = measurer.measureNode(para, 1)

      expect(m1.height).toBe(m2.height)
    })

    it('invalidates cache when range changes', () => {
      const para = schema.nodes.paragraph.create(
        null,
        schema.text('Content')
      )

      // Measure
      measurer.measureNode(para, 5)

      // Invalidate range
      measurer.invalidateRange(0, 10)

      // Should need to re-measure (cache miss)
      // Note: We can't directly verify cache miss without DOM,
      // but we can verify the method doesn't throw
      const m = measurer.measureNode(para, 5)
      expect(m.height).toBeGreaterThan(0)
    })

    it('clears all cache', () => {
      const para = schema.nodes.paragraph.create(
        null,
        schema.text('Content')
      )

      measurer.measureNode(para, 1)
      measurer.measureNode(para, 2)

      const statsBefore = measurer.getCacheStats()
      expect(statsBefore.size).toBe(2)

      measurer.clearCache()

      const statsAfter = measurer.getCacheStats()
      expect(statsAfter.size).toBe(0)
    })
  })

  describe('setDimensions', () => {
    it('updates dimensions and clears cache', () => {
      const para = schema.nodes.paragraph.create(
        null,
        schema.text('Content')
      )

      // Measure with initial dimensions
      measurer.measureNode(para, 1)
      expect(measurer.getCacheStats().size).toBe(1)

      // Update dimensions
      const newDimensions = createPageDimensions({
        ...DEFAULT_PAGINATION_CONFIG,
        pageSize: 'letter',
      })
      measurer.setDimensions(newDimensions)

      // Cache should be cleared
      expect(measurer.getCacheStats().size).toBe(0)
    })
  })
})
