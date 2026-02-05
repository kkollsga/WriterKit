import { describe, it, expect } from 'vitest'
import { parsePageRange, replaceTemplateVariables, DEFAULT_FONTS } from './types'

describe('parsePageRange', () => {
  it('returns all pages when range is undefined', () => {
    const result = parsePageRange(undefined, 5)
    expect(result).toEqual([1, 2, 3, 4, 5])
  })

  it('parses single page numbers', () => {
    const result = parsePageRange('3', 5)
    expect(result).toEqual([3])
  })

  it('parses comma-separated page numbers', () => {
    const result = parsePageRange('1,3,5', 10)
    expect(result).toEqual([1, 3, 5])
  })

  it('parses page ranges with hyphen', () => {
    const result = parsePageRange('2-4', 10)
    expect(result).toEqual([2, 3, 4])
  })

  it('parses mixed single pages and ranges', () => {
    const result = parsePageRange('1,3-5,8', 10)
    expect(result).toEqual([1, 3, 4, 5, 8])
  })

  it('caps page range at totalPages', () => {
    const result = parsePageRange('1-100', 5)
    expect(result).toEqual([1, 2, 3, 4, 5])
  })

  it('ignores pages less than 1', () => {
    const result = parsePageRange('0,1,2', 5)
    expect(result).toEqual([1, 2])
  })

  it('ignores pages greater than totalPages', () => {
    const result = parsePageRange('4,5,6', 5)
    expect(result).toEqual([4, 5])
  })

  it('handles whitespace in range', () => {
    const result = parsePageRange(' 1 , 3 - 5 ', 10)
    expect(result).toEqual([1, 3, 4, 5])
  })

  it('returns sorted and deduplicated pages', () => {
    const result = parsePageRange('5,1,3,1,5', 10)
    expect(result).toEqual([1, 3, 5])
  })
})

describe('replaceTemplateVariables', () => {
  it('replaces {{pageNumber}}', () => {
    const result = replaceTemplateVariables('Page {{pageNumber}}', {
      pageNumber: 5,
      totalPages: 10,
    })
    expect(result).toBe('Page 5')
  })

  it('replaces {{totalPages}}', () => {
    const result = replaceTemplateVariables('of {{totalPages}} pages', {
      pageNumber: 1,
      totalPages: 10,
    })
    expect(result).toBe('of 10 pages')
  })

  it('replaces {{title}}', () => {
    const result = replaceTemplateVariables('{{title}} - Page 1', {
      pageNumber: 1,
      totalPages: 10,
      title: 'My Document',
    })
    expect(result).toBe('My Document - Page 1')
  })

  it('replaces {{date}} with provided date', () => {
    const testDate = new Date('2024-01-15')
    const result = replaceTemplateVariables('{{date}}', {
      pageNumber: 1,
      totalPages: 10,
      date: testDate,
    })
    expect(result).toBe(testDate.toLocaleDateString())
  })

  it('replaces {{date}} with current date when not provided', () => {
    const result = replaceTemplateVariables('{{date}}', {
      pageNumber: 1,
      totalPages: 10,
    })
    expect(result).toBe(new Date().toLocaleDateString())
  })

  it('replaces multiple variables in one string', () => {
    const result = replaceTemplateVariables('{{title}} - Page {{pageNumber}} of {{totalPages}}', {
      pageNumber: 3,
      totalPages: 10,
      title: 'Report',
    })
    expect(result).toBe('Report - Page 3 of 10')
  })

  it('replaces empty string when title is undefined', () => {
    const result = replaceTemplateVariables('{{title}}Test', {
      pageNumber: 1,
      totalPages: 10,
    })
    expect(result).toBe('Test')
  })
})

describe('DEFAULT_FONTS', () => {
  it('has body font configuration', () => {
    expect(DEFAULT_FONTS.body).toBeDefined()
    expect(DEFAULT_FONTS.body.family).toBe('Helvetica')
    expect(DEFAULT_FONTS.body.size).toBe(12)
    expect(DEFAULT_FONTS.body.lineHeight).toBe(1.5)
  })

  it('has all heading levels', () => {
    expect(DEFAULT_FONTS.heading1).toBeDefined()
    expect(DEFAULT_FONTS.heading2).toBeDefined()
    expect(DEFAULT_FONTS.heading3).toBeDefined()
    expect(DEFAULT_FONTS.heading4).toBeDefined()
    expect(DEFAULT_FONTS.heading5).toBeDefined()
    expect(DEFAULT_FONTS.heading6).toBeDefined()
  })

  it('has code font configuration with monospace font', () => {
    expect(DEFAULT_FONTS.code).toBeDefined()
    expect(DEFAULT_FONTS.code.family).toBe('Courier')
  })

  it('heading sizes decrease by level', () => {
    expect(DEFAULT_FONTS.heading1.size).toBeGreaterThan(DEFAULT_FONTS.heading2.size)
    expect(DEFAULT_FONTS.heading2.size).toBeGreaterThan(DEFAULT_FONTS.heading3.size)
    expect(DEFAULT_FONTS.heading3.size).toBeGreaterThan(DEFAULT_FONTS.heading4.size)
  })
})
