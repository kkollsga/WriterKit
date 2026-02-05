/**
 * Functional tests for Measurer
 *
 * These tests verify the height estimation algorithm produces
 * reasonable and consistent values for pagination.
 *
 * Key behaviors tested:
 * - Height estimates are predictable and repeatable
 * - Content length affects estimated height correctly
 * - Different node types produce appropriate heights
 * - Block types that should be splittable are marked correctly
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Schema } from 'prosemirror-model'
import { Measurer } from './Measurer'
import { DEFAULT_PAGINATION_CONFIG, createPageDimensions } from './types'
import type { PageDimensions, PaginationConfig } from './types'

// Create a comprehensive test schema
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
    table: {
      group: 'block',
      content: 'tableRow+',
      toDOM() {
        return ['table', 0]
      },
    },
    tableRow: {
      content: 'tableCell+',
      toDOM() {
        return ['tr', 0]
      },
    },
    tableCell: {
      content: 'inline*',
      toDOM() {
        return ['td', 0]
      },
    },
    text: { group: 'inline' },
  },
})

describe('Measurer - Functional Height Estimation Tests', () => {
  let measurer: Measurer
  let config: PaginationConfig
  let dimensions: PageDimensions

  beforeEach(() => {
    config = { ...DEFAULT_PAGINATION_CONFIG }
    dimensions = createPageDimensions(config)
    measurer = new Measurer(config, dimensions)
  })

  describe('Paragraph Height Estimation', () => {
    it('empty paragraph has minimum height (one line)', () => {
      const emptyPara = schema.nodes.paragraph.create(null, [])
      const height = measurer.estimateNodeHeight(emptyPara)

      // Should be approximately one line height + margin
      expect(height).toBeGreaterThanOrEqual(config.defaultLineHeight)
      expect(height).toBeLessThan(config.defaultLineHeight * 3) // Not more than 3 lines
    })

    it('short text paragraph has reasonable height', () => {
      const shortPara = schema.nodes.paragraph.create(
        null,
        schema.text('Hello world')
      )
      const height = measurer.estimateNodeHeight(shortPara)

      // Short text should be roughly 1-2 lines
      const minExpected = config.defaultLineHeight
      const maxExpected = config.defaultLineHeight * 2 + 20 // Plus margin

      expect(height).toBeGreaterThanOrEqual(minExpected)
      expect(height).toBeLessThan(maxExpected)
    })

    it('longer text paragraph is taller than short one', () => {
      const shortPara = schema.nodes.paragraph.create(
        null,
        schema.text('Short text.')
      )
      const longPara = schema.nodes.paragraph.create(
        null,
        schema.text('A'.repeat(500))
      )

      const shortHeight = measurer.estimateNodeHeight(shortPara)
      const longHeight = measurer.estimateNodeHeight(longPara)

      expect(longHeight).toBeGreaterThan(shortHeight)
    })

    it('height scales approximately linearly with text length', () => {
      const text100 = schema.nodes.paragraph.create(
        null,
        schema.text('A'.repeat(100))
      )
      const text200 = schema.nodes.paragraph.create(
        null,
        schema.text('A'.repeat(200))
      )
      const text300 = schema.nodes.paragraph.create(
        null,
        schema.text('A'.repeat(300))
      )

      const h100 = measurer.estimateNodeHeight(text100)
      const h200 = measurer.estimateNodeHeight(text200)
      const h300 = measurer.estimateNodeHeight(text300)

      // Height should increase with length
      expect(h200).toBeGreaterThan(h100)
      expect(h300).toBeGreaterThan(h200)

      // The increase from 100->200 should be similar to 200->300
      const delta1 = h200 - h100
      const delta2 = h300 - h200

      // Allow variance in scaling (not perfectly linear due to margins/rounding)
      // Both deltas should be positive and within reasonable ratio
      expect(delta1).toBeGreaterThan(0)
      expect(delta2).toBeGreaterThan(0)
      expect(delta2).toBeGreaterThanOrEqual(delta1 * 0.3)
      expect(delta2).toBeLessThanOrEqual(delta1 * 3)
    })

    it('same content produces same height (deterministic)', () => {
      const para = schema.nodes.paragraph.create(
        null,
        schema.text('Consistent measurement test')
      )

      const h1 = measurer.estimateNodeHeight(para)
      const h2 = measurer.estimateNodeHeight(para)
      const h3 = measurer.estimateNodeHeight(para)

      expect(h1).toBe(h2)
      expect(h2).toBe(h3)
    })
  })

  describe('Heading Height Estimation', () => {
    it('h1 is taller than h3', () => {
      const h1 = schema.nodes.heading.create(
        { level: 1 },
        schema.text('Heading One')
      )
      const h3 = schema.nodes.heading.create(
        { level: 3 },
        schema.text('Heading Three')
      )

      const h1Height = measurer.estimateNodeHeight(h1)
      const h3Height = measurer.estimateNodeHeight(h3)

      expect(h1Height).toBeGreaterThan(h3Height)
    })

    it('heading levels produce decreasing heights', () => {
      const headings = [1, 2, 3, 4, 5, 6].map((level) =>
        schema.nodes.heading.create({ level }, schema.text(`Heading ${level}`))
      )

      const heights = headings.map((h) => measurer.estimateNodeHeight(h))

      // Each heading should be taller or equal to the next level
      for (let i = 0; i < heights.length - 1; i++) {
        expect(heights[i]).toBeGreaterThanOrEqual(heights[i + 1])
      }
    })

    it('heading is taller than same-text paragraph', () => {
      const text = 'Sample Title'
      const heading = schema.nodes.heading.create(
        { level: 1 },
        schema.text(text)
      )
      const paragraph = schema.nodes.paragraph.create(null, schema.text(text))

      const headingHeight = measurer.estimateNodeHeight(heading)
      const paragraphHeight = measurer.estimateNodeHeight(paragraph)

      expect(headingHeight).toBeGreaterThan(paragraphHeight)
    })
  })

  describe('Code Block Height Estimation', () => {
    it('code block height scales with line count', () => {
      const singleLine = schema.nodes.codeBlock.create(
        null,
        schema.text('const x = 1;')
      )
      const multiLine = schema.nodes.codeBlock.create(
        null,
        schema.text('const x = 1;\nconst y = 2;\nconst z = 3;')
      )
      const manyLines = schema.nodes.codeBlock.create(
        null,
        schema.text(Array(10).fill('line').join('\n'))
      )

      const h1 = measurer.estimateNodeHeight(singleLine)
      const h3 = measurer.estimateNodeHeight(multiLine)
      const h10 = measurer.estimateNodeHeight(manyLines)

      expect(h3).toBeGreaterThan(h1)
      expect(h10).toBeGreaterThan(h3)
    })

    it('empty code block has minimum height (padding)', () => {
      const emptyCode = schema.nodes.codeBlock.create(null, [])
      const height = measurer.estimateNodeHeight(emptyCode)

      // Should have at least padding (24 points default)
      expect(height).toBeGreaterThanOrEqual(24)
    })
  })

  describe('List Height Estimation', () => {
    it('list height scales with item count', () => {
      const createList = (itemCount: number) => {
        const items = Array(itemCount)
          .fill(null)
          .map((_, i) =>
            schema.nodes.listItem.create(null, [
              schema.nodes.paragraph.create(null, schema.text(`Item ${i + 1}`)),
            ])
          )
        return schema.nodes.bulletList.create(null, items)
      }

      const list2 = createList(2)
      const list5 = createList(5)
      const list10 = createList(10)

      const h2 = measurer.estimateNodeHeight(list2)
      const h5 = measurer.estimateNodeHeight(list5)
      const h10 = measurer.estimateNodeHeight(list10)

      expect(h5).toBeGreaterThan(h2)
      expect(h10).toBeGreaterThan(h5)

      // 10 items should be roughly 5x 2 items (within reason)
      expect(h10 / h2).toBeGreaterThan(2)
      expect(h10 / h2).toBeLessThan(10)
    })

    it('bulletList and orderedList have similar heights', () => {
      const createItem = (text: string) =>
        schema.nodes.listItem.create(null, [
          schema.nodes.paragraph.create(null, schema.text(text)),
        ])

      const items = [createItem('Item 1'), createItem('Item 2')]

      const bulletList = schema.nodes.bulletList.create(null, items)
      const orderedList = schema.nodes.orderedList.create(null, items)

      const bulletHeight = measurer.estimateNodeHeight(bulletList)
      const orderedHeight = measurer.estimateNodeHeight(orderedList)

      // Should be very similar (within 10%)
      expect(Math.abs(bulletHeight - orderedHeight)).toBeLessThan(
        bulletHeight * 0.1
      )
    })
  })

  describe('Special Node Types', () => {
    it('horizontal rule has fixed height', () => {
      const hr = schema.nodes.horizontalRule.create()
      const height = measurer.estimateNodeHeight(hr)

      expect(height).toBe(20) // Fixed per implementation
    })

    it('page break has zero height', () => {
      const pageBreak = schema.nodes.pageBreak.create()
      const height = measurer.estimateNodeHeight(pageBreak)

      expect(height).toBe(0)
    })

    it('blockquote includes child height plus padding', () => {
      const innerPara = schema.nodes.paragraph.create(
        null,
        schema.text('Quoted text content')
      )
      const blockquote = schema.nodes.blockquote.create(null, [innerPara])

      const paraHeight = measurer.estimateNodeHeight(innerPara)
      const quoteHeight = measurer.estimateNodeHeight(blockquote)

      // Blockquote should be taller than inner content due to padding
      expect(quoteHeight).toBeGreaterThan(paraHeight)
      // But not excessively taller (max 30 points padding expected)
      expect(quoteHeight).toBeLessThan(paraHeight + 30)
    })
  })

  describe('Splittable Block Detection', () => {
    it('marks bulletList as splittable', () => {
      const item = schema.nodes.listItem.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Item')),
      ])
      const list = schema.nodes.bulletList.create(null, [item, item])

      const measurement = measurer.measureNode(list, 1)

      expect(measurement.splittable).toBe(true)
      expect(measurement.itemHeights).toBeDefined()
      expect(measurement.itemHeights!.length).toBe(2)
    })

    it('marks orderedList as splittable', () => {
      const item = schema.nodes.listItem.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Item')),
      ])
      const list = schema.nodes.orderedList.create(null, [item, item])

      const measurement = measurer.measureNode(list, 1)

      expect(measurement.splittable).toBe(true)
    })

    it('marks paragraph as NOT splittable', () => {
      const para = schema.nodes.paragraph.create(
        null,
        schema.text('Content')
      )

      const measurement = measurer.measureNode(para, 1)

      expect(measurement.splittable).toBe(false)
    })

    it('marks heading as NOT splittable', () => {
      const heading = schema.nodes.heading.create(
        { level: 1 },
        schema.text('Title')
      )

      const measurement = measurer.measureNode(heading, 1)

      expect(measurement.splittable).toBe(false)
    })
  })

  describe('measureDocument Accuracy', () => {
    it('measures all blocks and returns correct count', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.heading.create({ level: 1 }, schema.text('Title')),
        schema.nodes.paragraph.create(null, schema.text('Para 1')),
        schema.nodes.paragraph.create(null, schema.text('Para 2')),
        schema.nodes.horizontalRule.create(),
        schema.nodes.paragraph.create(null, schema.text('Para 3')),
      ])

      const measurements = measurer.measureDocument(doc)

      expect(measurements).toHaveLength(5)
      expect(measurements[0].type).toBe('heading')
      expect(measurements[1].type).toBe('paragraph')
      expect(measurements[2].type).toBe('paragraph')
      expect(measurements[3].type).toBe('horizontalRule')
      expect(measurements[4].type).toBe('paragraph')
    })

    it('total measured height is sum of individual heights', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Para 1')),
        schema.nodes.paragraph.create(null, schema.text('Para 2')),
        schema.nodes.paragraph.create(null, schema.text('Para 3')),
      ])

      const measurements = measurer.measureDocument(doc)
      const totalHeight = measurements.reduce((sum, m) => sum + m.height, 0)

      // Each measurement should contribute to total
      expect(totalHeight).toBe(
        measurements[0].height + measurements[1].height + measurements[2].height
      )
    })

    it('positions are assigned correctly', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('First')),
        schema.nodes.paragraph.create(null, schema.text('Second')),
      ])

      const measurements = measurer.measureDocument(doc)

      expect(measurements[0].pos).toBe(1) // First block starts at doc+1
      expect(measurements[1].pos).toBeGreaterThan(measurements[0].pos)
    })
  })

  describe('Content Width Dependence', () => {
    it('narrower content width produces taller paragraphs', () => {
      // Create measurer with narrow page
      const narrowConfig = {
        ...config,
        margins: { top: 72, right: 200, bottom: 72, left: 200 },
      }
      const narrowDimensions = createPageDimensions(narrowConfig)
      const narrowMeasurer = new Measurer(narrowConfig, narrowDimensions)

      // Create measurer with wide page
      const wideConfig = {
        ...config,
        margins: { top: 72, right: 36, bottom: 72, left: 36 },
      }
      const wideDimensions = createPageDimensions(wideConfig)
      const wideMeasurer = new Measurer(wideConfig, wideDimensions)

      // Same long text
      const longText = 'A'.repeat(200)
      const para = schema.nodes.paragraph.create(null, schema.text(longText))

      const narrowHeight = narrowMeasurer.estimateNodeHeight(para)
      const wideHeight = wideMeasurer.estimateNodeHeight(para)

      // Narrow page should wrap more, producing taller content
      expect(narrowHeight).toBeGreaterThan(wideHeight)
    })
  })

  describe('Cache Behavior', () => {
    it('cache hit returns same value', () => {
      const para = schema.nodes.paragraph.create(
        null,
        schema.text('Cached content')
      )

      // First measurement (cache miss)
      const m1 = measurer.measureNode(para, 1)

      // Second measurement (should hit cache)
      const m2 = measurer.measureNode(para, 1)

      expect(m1.height).toBe(m2.height)

      const stats = measurer.getCacheStats()
      expect(stats.hits).toBeGreaterThan(0)
    })

    it('different positions are cached separately', () => {
      const para = schema.nodes.paragraph.create(
        null,
        schema.text('Content')
      )

      measurer.measureNode(para, 1)
      measurer.measureNode(para, 5)
      measurer.measureNode(para, 10)

      const stats = measurer.getCacheStats()
      expect(stats.size).toBe(3)
    })
  })
})

describe('Measurer - Height Bounds Verification', () => {
  let measurer: Measurer
  let dimensions: PageDimensions

  beforeEach(() => {
    const config = { ...DEFAULT_PAGINATION_CONFIG }
    dimensions = createPageDimensions(config)
    measurer = new Measurer(config, dimensions)
  })

  it('no estimated height exceeds reasonable maximum', () => {
    // Create various content types
    const nodes = [
      schema.nodes.paragraph.create(null, schema.text('Short')),
      schema.nodes.paragraph.create(null, schema.text('A'.repeat(1000))),
      schema.nodes.heading.create({ level: 1 }, schema.text('Big Heading')),
      schema.nodes.codeBlock.create(
        null,
        schema.text(Array(20).fill('code line').join('\n'))
      ),
    ]

    for (const node of nodes) {
      const height = measurer.estimateNodeHeight(node)

      // No single block should exceed page content height (unreasonable)
      // Allow up to 2x for very long content
      expect(height).toBeLessThan(dimensions.contentHeight * 2)
    }
  })

  it('no estimated height is negative', () => {
    const nodes = [
      schema.nodes.paragraph.create(null, []),
      schema.nodes.heading.create({ level: 6 }, []),
      schema.nodes.horizontalRule.create(),
      schema.nodes.pageBreak.create(),
    ]

    for (const node of nodes) {
      const height = measurer.estimateNodeHeight(node)
      expect(height).toBeGreaterThanOrEqual(0)
    }
  })
})
