import { describe, it, expect, beforeEach } from 'vitest'
import { Schema } from 'prosemirror-model'
import { PageComputer } from './PageComputer'
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
    pageBreak: {
      group: 'block',
      toDOM() {
        return ['div', { class: 'page-break' }]
      },
    },
    text: { group: 'inline' },
  },
})

describe('PageComputer', () => {
  let computer: PageComputer
  let measurer: Measurer
  let dimensions: ReturnType<typeof createPageDimensions>

  beforeEach(() => {
    dimensions = createPageDimensions(DEFAULT_PAGINATION_CONFIG)
    computer = new PageComputer(DEFAULT_PAGINATION_CONFIG, dimensions)
    measurer = new Measurer(DEFAULT_PAGINATION_CONFIG, dimensions)
    computer.setMeasurer(measurer)
  })

  describe('compute', () => {
    it('computes single page for small document', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Short paragraph')),
      ])

      const model = computer.compute(doc)

      expect(model.pageCount).toBe(1)
      expect(model.pages[0].pageNumber).toBe(1)
      expect(model.pages[0].startPos).toBe(0)
      expect(model.pages[0].forcedBreak).toBe(false)
    })

    it('respects forced page breaks', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Page 1 content')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('Page 2 content')),
      ])

      const model = computer.compute(doc)

      expect(model.pageCount).toBe(2)
      expect(model.pages[0].pageNumber).toBe(1)
      expect(model.pages[1].pageNumber).toBe(2)
      expect(model.pages[1].forcedBreak).toBe(true)
    })

    it('creates multiple forced page breaks', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Page 1')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('Page 2')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('Page 3')),
      ])

      const model = computer.compute(doc)

      expect(model.pageCount).toBe(3)
      expect(model.pages[1].forcedBreak).toBe(true)
      expect(model.pages[2].forcedBreak).toBe(true)
    })

    it('includes page dimensions in model', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Content')),
      ])

      const model = computer.compute(doc)

      expect(model.dimensions).toEqual(dimensions)
    })

    it('calculates total content height', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Para 1')),
        schema.nodes.paragraph.create(null, schema.text('Para 2')),
      ])

      const model = computer.compute(doc)

      expect(model.totalContentHeight).toBeGreaterThan(0)
    })

    it('tracks node positions on each page', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.heading.create({ level: 1 }, schema.text('Title')),
        schema.nodes.paragraph.create(null, schema.text('Content')),
      ])

      const model = computer.compute(doc)

      expect(model.pages[0].nodePositions.length).toBe(2)
      expect(model.pages[0].nodePositions[0].type).toBe('heading')
      expect(model.pages[0].nodePositions[1].type).toBe('paragraph')
    })

    it('throws without measurer', () => {
      const computerNoMeasurer = new PageComputer(
        DEFAULT_PAGINATION_CONFIG,
        dimensions
      )

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Content')),
      ])

      expect(() => computerNoMeasurer.compute(doc)).toThrow(
        'Measurer not set'
      )
    })
  })

  describe('getPageForPosition', () => {
    it('returns correct page for position', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Page 1')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('Page 2')),
      ])

      const model = computer.compute(doc)

      // Position 0 should be on page 1
      expect(computer.getPageForPosition(model, 0)).toBe(1)

      // Position after page break should be on page 2
      const page2Start = model.pages[1].startPos
      expect(computer.getPageForPosition(model, page2Start)).toBe(2)
    })

    it('returns last page for positions beyond document', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Content')),
      ])

      const model = computer.compute(doc)

      expect(computer.getPageForPosition(model, 9999)).toBe(model.pageCount)
    })
  })

  describe('getPage', () => {
    it('returns page boundary by number', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Page 1')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('Page 2')),
      ])

      const model = computer.compute(doc)

      const page1 = computer.getPage(model, 1)
      const page2 = computer.getPage(model, 2)

      expect(page1?.pageNumber).toBe(1)
      expect(page2?.pageNumber).toBe(2)
    })

    it('returns null for invalid page number', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Content')),
      ])

      const model = computer.compute(doc)

      expect(computer.getPage(model, 0)).toBeNull()
      expect(computer.getPage(model, 99)).toBeNull()
    })
  })

  describe('computeFrom (incremental)', () => {
    it('recomputes from a position forward', () => {
      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Para 1')),
        schema.nodes.paragraph.create(null, schema.text('Para 2')),
        schema.nodes.pageBreak.create(),
        schema.nodes.paragraph.create(null, schema.text('Para 3')),
      ])

      // First compute
      const model1 = computer.compute(doc)

      // Compute incrementally from position 0
      const model2 = computer.computeFrom(doc, model1, 0)

      // Should still have the same structure
      expect(model2.pageCount).toBe(model1.pageCount)
    })
  })

  describe('setDimensions', () => {
    it('updates dimensions for computation', () => {
      const newDimensions = createPageDimensions({
        ...DEFAULT_PAGINATION_CONFIG,
        pageSize: 'letter',
      })

      computer.setDimensions(newDimensions)

      const doc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Content')),
      ])

      const model = computer.compute(doc)

      expect(model.dimensions).toEqual(newDimensions)
    })
  })
})
