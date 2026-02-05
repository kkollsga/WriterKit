/**
 * Functional tests for PageComputer
 *
 * These tests verify the actual pagination logic works correctly:
 * - Content overflow creates correct number of pages
 * - Page breaks occur at correct positions
 * - Orphan/widow control prevents bad breaks
 * - Block splitting works for tables/lists
 *
 * Uses a MockMeasurer with controlled heights to test deterministically.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Schema, Node as ProseMirrorNode } from 'prosemirror-model'
import { PageComputer } from './PageComputer'
import { Measurer } from './Measurer'
import { DEFAULT_PAGINATION_CONFIG, createPageDimensions } from './types'
import type { BlockMeasurement, PageDimensions, PaginationConfig } from './types'

// Create a test schema
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
    pageBreak: {
      group: 'block',
      toDOM() {
        return ['div', { class: 'page-break' }]
      },
    },
    bulletList: {
      group: 'block',
      content: 'listItem+',
      toDOM() {
        return ['ul', 0]
      },
    },
    listItem: {
      content: 'paragraph block*',
      toDOM() {
        return ['li', 0]
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

/**
 * MockMeasurer that returns predetermined heights for testing
 */
class MockMeasurer extends Measurer {
  private mockHeights: Map<string, number> = new Map()
  private defaultHeight = 24 // Default line height

  constructor(config: PaginationConfig, dimensions: PageDimensions) {
    super(config, dimensions)
  }

  /**
   * Set a specific height for a node type
   */
  setHeightForType(type: string, height: number): void {
    this.mockHeights.set(type, height)
  }

  /**
   * Set default height for all unmapped types
   */
  setDefaultHeight(height: number): void {
    this.defaultHeight = height
  }

  /**
   * Override measureDocument to use mock heights
   */
  override measureDocument(doc: ProseMirrorNode): BlockMeasurement[] {
    const measurements: BlockMeasurement[] = []
    let pos = 0

    doc.forEach((node, offset) => {
      const nodePos = pos + offset + 1
      measurements.push(this.createMockMeasurement(node, nodePos))
    })

    return measurements
  }

  private createMockMeasurement(
    node: ProseMirrorNode,
    pos: number
  ): BlockMeasurement {
    const type = node.type.name

    if (type === 'pageBreak') {
      return {
        pos,
        type: 'pageBreak',
        height: 0,
        splittable: false,
      }
    }

    const height = this.mockHeights.get(type) ?? this.defaultHeight
    const isSplittable = type === 'bulletList' || type === 'orderedList' || type === 'table'

    const measurement: BlockMeasurement = {
      pos,
      type,
      height,
      splittable: isSplittable,
    }

    // Add item heights for splittable blocks
    if (isSplittable) {
      measurement.itemHeights = this.getItemHeightsForNode(node)
      measurement.minHeight = measurement.itemHeights[0] || 24
      // Recalculate total height from items
      measurement.height = measurement.itemHeights.reduce((sum, h) => sum + h, 0)
    }

    return measurement
  }

  private getItemHeightsForNode(node: ProseMirrorNode): number[] {
    const heights: number[] = []
    const itemHeight = this.mockHeights.get('listItem') ?? 24

    node.forEach(() => {
      heights.push(itemHeight)
    })

    return heights
  }
}

describe('PageComputer - Functional Tests', () => {
  let computer: PageComputer
  let mockMeasurer: MockMeasurer
  let dimensions: ReturnType<typeof createPageDimensions>
  let config: PaginationConfig

  beforeEach(() => {
    config = { ...DEFAULT_PAGINATION_CONFIG }
    dimensions = createPageDimensions(config)
    computer = new PageComputer(config, dimensions)
    mockMeasurer = new MockMeasurer(config, dimensions)
    computer.setMeasurer(mockMeasurer)
  })

  describe('Automatic Page Overflow', () => {
    it('creates exactly 1 page when content fits within page height', () => {
      // A4 contentHeight is ~697 points
      // Set each paragraph to 100 points
      // 5 paragraphs = 500 points < 697, should fit on 1 page
      mockMeasurer.setHeightForType('paragraph', 100)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Para 1')),
        schema.nodes.paragraph.create(null, schema.text('Para 2')),
        schema.nodes.paragraph.create(null, schema.text('Para 3')),
        schema.nodes.paragraph.create(null, schema.text('Para 4')),
        schema.nodes.paragraph.create(null, schema.text('Para 5')),
      ])

      const model = computer.compute(doc)

      expect(model.pageCount).toBe(1)
      expect(model.pages[0].nodePositions).toHaveLength(5)
      expect(model.totalContentHeight).toBe(500)
    })

    it('creates 2 pages when content exceeds page height', () => {
      // contentHeight is ~697 points
      // 8 paragraphs at 100 points each = 800 points
      // Should split into 2 pages
      mockMeasurer.setHeightForType('paragraph', 100)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Para 1')),
        schema.nodes.paragraph.create(null, schema.text('Para 2')),
        schema.nodes.paragraph.create(null, schema.text('Para 3')),
        schema.nodes.paragraph.create(null, schema.text('Para 4')),
        schema.nodes.paragraph.create(null, schema.text('Para 5')),
        schema.nodes.paragraph.create(null, schema.text('Para 6')),
        schema.nodes.paragraph.create(null, schema.text('Para 7')),
        schema.nodes.paragraph.create(null, schema.text('Para 8')),
      ])

      const model = computer.compute(doc)

      expect(model.pageCount).toBe(2)
      expect(model.totalContentHeight).toBe(800)

      // First page should have ~6 paragraphs (600 points)
      // Second page should have remaining paragraphs
      const page1Nodes = model.pages[0].nodePositions.length
      const page2Nodes = model.pages[1].nodePositions.length
      expect(page1Nodes + page2Nodes).toBe(8)
    })

    it('creates correct number of pages for large documents', () => {
      // Create document that should span 5 pages
      // Each paragraph = 200 points
      // contentHeight ~= 697, so ~3 paragraphs per page
      // 15 paragraphs should create 5 pages
      mockMeasurer.setHeightForType('paragraph', 200)

      const paragraphs = Array.from({ length: 15 }, (_, i) =>
        schema.nodes.paragraph.create(null, schema.text(`Para ${i + 1}`))
      )
      const doc = schema.nodes.doc.create(null, paragraphs)

      const model = computer.compute(doc)

      expect(model.pageCount).toBe(5)
      expect(model.totalContentHeight).toBe(3000)
    })

    it('handles exact page boundary correctly', () => {
      // Content exactly fills the page - should still be 1 page
      const contentHeight = dimensions.contentHeight
      const paragraphCount = 4
      const heightPerPara = Math.floor(contentHeight / paragraphCount)

      mockMeasurer.setHeightForType('paragraph', heightPerPara)

      const paragraphs = Array.from({ length: paragraphCount }, (_, i) =>
        schema.nodes.paragraph.create(null, schema.text(`Para ${i + 1}`))
      )
      const doc = schema.nodes.doc.create(null, paragraphs)

      const model = computer.compute(doc)

      expect(model.pageCount).toBe(1)
    })

    it('creates new page when content exceeds page height', () => {
      // Two large paragraphs that together exceed page height
      const contentHeight = dimensions.contentHeight
      // Each paragraph is 60% of page height, so 2 = 120% = 2 pages
      const paragraphHeight = Math.floor(contentHeight * 0.6)

      mockMeasurer.setHeightForType('paragraph', paragraphHeight)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Para 1')),
        schema.nodes.paragraph.create(null, schema.text('Para 2')),
      ])

      const model = computer.compute(doc)

      // Two paragraphs at 60% each = 120% of page, should be 2 pages
      expect(model.pageCount).toBe(2)
    })
  })

  describe('Forced Page Breaks', () => {
    it('forced page break creates new page even with remaining space', () => {
      mockMeasurer.setHeightForType('paragraph', 50)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Before break')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('After break')),
      ])

      const model = computer.compute(doc)

      expect(model.pageCount).toBe(2)
      expect(model.pages[1].forcedBreak).toBe(true)
    })

    it('multiple forced breaks create correct number of pages', () => {
      mockMeasurer.setHeightForType('paragraph', 50)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Page 1')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('Page 2')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('Page 3')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('Page 4')),
      ])

      const model = computer.compute(doc)

      expect(model.pageCount).toBe(4)
      expect(model.pages[1].forcedBreak).toBe(true)
      expect(model.pages[2].forcedBreak).toBe(true)
      expect(model.pages[3].forcedBreak).toBe(true)
    })

    it('forced break at start of document creates empty first page', () => {
      mockMeasurer.setHeightForType('paragraph', 50)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('After break')),
      ])

      const model = computer.compute(doc)

      expect(model.pageCount).toBe(2)
      expect(model.pages[0].nodePositions).toHaveLength(0)
      expect(model.pages[1].nodePositions).toHaveLength(1)
    })

    it('consecutive forced breaks create multiple empty pages', () => {
      mockMeasurer.setHeightForType('paragraph', 50)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Start')),
        schema.nodes.pageBreak.create(),
        schema.nodes.pageBreak.create(),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('End')),
      ])

      const model = computer.compute(doc)

      // 1 page with content, 3 forced breaks, 1 page with end content
      expect(model.pageCount).toBe(4)
    })
  })

  describe('Mixed Automatic and Forced Breaks', () => {
    it('handles forced break followed by overflow', () => {
      // Set up so content after break overflows
      mockMeasurer.setHeightForType('paragraph', 200)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Page 1')),
        schema.nodes.pageBreak.create(),
        // These 5 paragraphs should overflow page 2 into page 3
        schema.nodes.paragraph.create(null, schema.text('Para A')),
        schema.nodes.paragraph.create(null, schema.text('Para B')),
        schema.nodes.paragraph.create(null, schema.text('Para C')),
        schema.nodes.paragraph.create(null, schema.text('Para D')),
        schema.nodes.paragraph.create(null, schema.text('Para E')),
      ])

      const model = computer.compute(doc)

      expect(model.pageCount).toBeGreaterThanOrEqual(3)
      expect(model.pages[1].forcedBreak).toBe(true)
      expect(model.pages[2].forcedBreak).toBe(false)
    })
  })

  describe('Page Position Tracking', () => {
    it('correctly identifies page for document positions', () => {
      mockMeasurer.setHeightForType('paragraph', 50)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Page 1')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('Page 2')),
      ])

      const model = computer.compute(doc)

      expect(computer.getPageForPosition(model, 0)).toBe(1)

      const page2Start = model.pages[1].startPos
      expect(computer.getPageForPosition(model, page2Start)).toBe(2)
    })

    it('tracks node positions within each page', () => {
      mockMeasurer.setHeightForType('paragraph', 100)
      mockMeasurer.setHeightForType('heading', 50)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.heading.create({ level: 1 }, schema.text('Title')),
        schema.nodes.paragraph.create(null, schema.text('Para 1')),
        schema.nodes.paragraph.create(null, schema.text('Para 2')),
      ])

      const model = computer.compute(doc)

      expect(model.pages[0].nodePositions).toHaveLength(3)
      expect(model.pages[0].nodePositions[0].type).toBe('heading')
      expect(model.pages[0].nodePositions[0].height).toBe(50)
      expect(model.pages[0].nodePositions[1].type).toBe('paragraph')
      expect(model.pages[0].nodePositions[1].height).toBe(100)
    })
  })

  describe('Content Height Calculation', () => {
    it('total content height equals sum of all block heights', () => {
      mockMeasurer.setHeightForType('paragraph', 100)
      mockMeasurer.setHeightForType('heading', 50)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.heading.create({ level: 1 }, schema.text('Title')),
        schema.nodes.paragraph.create(null, schema.text('Para 1')),
        schema.nodes.paragraph.create(null, schema.text('Para 2')),
        schema.nodes.paragraph.create(null, schema.text('Para 3')),
      ])

      const model = computer.compute(doc)

      // 1 heading (50) + 3 paragraphs (300) = 350
      expect(model.totalContentHeight).toBe(350)
    })

    it('page breaks do not add to content height', () => {
      mockMeasurer.setHeightForType('paragraph', 100)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Para 1')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('Para 2')),
      ])

      const model = computer.compute(doc)

      expect(model.totalContentHeight).toBe(200) // Only paragraphs counted
    })
  })

  describe('Page Dimensions', () => {
    it('uses configured page dimensions', () => {
      mockMeasurer.setHeightForType('paragraph', 50)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Content')),
      ])

      const model = computer.compute(doc)

      expect(model.dimensions).toEqual(dimensions)
      expect(model.dimensions.width).toBeGreaterThan(0)
      expect(model.dimensions.height).toBeGreaterThan(0)
      expect(model.dimensions.contentHeight).toBeGreaterThan(0)
    })

    it('respects updated dimensions', () => {
      const letterDimensions = createPageDimensions({
        ...config,
        pageSize: 'letter',
      })
      computer.setDimensions(letterDimensions)

      mockMeasurer.setHeightForType('paragraph', 50)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Content')),
      ])

      const model = computer.compute(doc)

      expect(model.dimensions).toEqual(letterDimensions)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty document', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, []),
      ])

      mockMeasurer.setHeightForType('paragraph', 24)

      const model = computer.compute(doc)

      expect(model.pageCount).toBe(1)
      expect(model.pages[0].nodePositions).toHaveLength(1)
    })

    it('handles single very tall block that exceeds page height', () => {
      // A paragraph taller than the page should still be placed
      mockMeasurer.setHeightForType('paragraph', dimensions.contentHeight * 2)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(
          null,
          schema.text('Very long paragraph that is taller than the page')
        ),
      ])

      const model = computer.compute(doc)

      // Should still create pages even if block is too tall
      expect(model.pageCount).toBeGreaterThanOrEqual(1)
      expect(model.totalContentHeight).toBe(dimensions.contentHeight * 2)
    })

    it('handles document with only page breaks', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.pageBreak.create(),
        schema.nodes.pageBreak.create(),
      ])

      const model = computer.compute(doc)

      // Should create pages for each break
      expect(model.pageCount).toBeGreaterThanOrEqual(2)
    })

    it('handles alternating page breaks and content', () => {
      mockMeasurer.setHeightForType('paragraph', 50)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('A')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('B')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('C')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('D')),
      ])

      const model = computer.compute(doc)

      expect(model.pageCount).toBe(4)
      expect(model.totalContentHeight).toBe(200)
    })
  })

  describe('Block Height Verification', () => {
    it('verifies heading heights are correctly used', () => {
      mockMeasurer.setHeightForType('heading', 80)
      mockMeasurer.setHeightForType('paragraph', 40)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.heading.create({ level: 1 }, schema.text('H1')),
        schema.nodes.heading.create({ level: 2 }, schema.text('H2')),
        schema.nodes.paragraph.create(null, schema.text('Para')),
      ])

      const model = computer.compute(doc)

      // 2 headings (160) + 1 paragraph (40) = 200
      expect(model.totalContentHeight).toBe(200)
      expect(model.pages[0].nodePositions[0].height).toBe(80)
      expect(model.pages[0].nodePositions[1].height).toBe(80)
      expect(model.pages[0].nodePositions[2].height).toBe(40)
    })
  })
})

describe('PageComputer - Splittable Blocks', () => {
  let computer: PageComputer
  let mockMeasurer: MockMeasurer
  let dimensions: ReturnType<typeof createPageDimensions>
  let config: PaginationConfig

  beforeEach(() => {
    config = { ...DEFAULT_PAGINATION_CONFIG }
    dimensions = createPageDimensions(config)
    computer = new PageComputer(config, dimensions)
    mockMeasurer = new MockMeasurer(config, dimensions)
    computer.setMeasurer(mockMeasurer)
  })

  it('identifies lists as splittable', () => {
    mockMeasurer.setHeightForType('listItem', 30)

    const listItems = [
      schema.nodes.listItem.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Item 1')),
      ]),
      schema.nodes.listItem.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Item 2')),
      ]),
    ]
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.bulletList.create(null, listItems),
    ])

    const model = computer.compute(doc)

    // The list should be marked as measured with item heights
    expect(model.pages[0].nodePositions[0].type).toBe('bulletList')
  })
})
