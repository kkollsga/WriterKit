import { describe, it, expect } from 'vitest'
import {
  PAGE_SIZES,
  DEFAULT_PAGINATION_CONFIG,
  createPageDimensions,
  configFromMetadata,
} from './types'
import type { DocumentMetadata } from '@writerkit/core'

describe('types', () => {
  describe('PAGE_SIZES', () => {
    it('has A4 dimensions in points', () => {
      expect(PAGE_SIZES.a4).toEqual({
        width: 595.28,
        height: 841.89,
      })
    })

    it('has Letter dimensions in points', () => {
      expect(PAGE_SIZES.letter).toEqual({
        width: 612,
        height: 792,
      })
    })

    it('has Legal dimensions in points', () => {
      expect(PAGE_SIZES.legal).toEqual({
        width: 612,
        height: 1008,
      })
    })

    it('has all standard sizes', () => {
      expect(Object.keys(PAGE_SIZES)).toEqual(['a4', 'letter', 'legal', 'a3', 'a5'])
    })
  })

  describe('DEFAULT_PAGINATION_CONFIG', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_PAGINATION_CONFIG.pageSize).toBe('a4')
      expect(DEFAULT_PAGINATION_CONFIG.orientation).toBe('portrait')
      expect(DEFAULT_PAGINATION_CONFIG.margins).toEqual({
        top: 72,
        right: 72,
        bottom: 72,
        left: 72,
      })
    })

    it('has performance defaults', () => {
      expect(DEFAULT_PAGINATION_CONFIG.reflowDebounceMs).toBe(100)
      expect(DEFAULT_PAGINATION_CONFIG.pixelsPerPoint).toBeCloseTo(1.333)
    })

    it('has typography defaults', () => {
      expect(DEFAULT_PAGINATION_CONFIG.widowLines).toBe(2)
      expect(DEFAULT_PAGINATION_CONFIG.orphanLines).toBe(2)
      expect(DEFAULT_PAGINATION_CONFIG.defaultLineHeight).toBe(14)
    })
  })

  describe('createPageDimensions', () => {
    it('creates A4 portrait dimensions', () => {
      const dims = createPageDimensions({
        pageSize: 'a4',
        orientation: 'portrait',
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
        headerHeight: 0,
        footerHeight: 0,
      })

      expect(dims.width).toBe(595.28)
      expect(dims.height).toBe(841.89)
      expect(dims.contentWidth).toBe(595.28 - 72 - 72)
      expect(dims.contentHeight).toBe(841.89 - 72 - 72)
    })

    it('creates A4 landscape dimensions', () => {
      const dims = createPageDimensions({
        pageSize: 'a4',
        orientation: 'landscape',
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
        headerHeight: 0,
        footerHeight: 0,
      })

      // Swapped for landscape
      expect(dims.width).toBe(841.89)
      expect(dims.height).toBe(595.28)
    })

    it('accounts for header and footer height', () => {
      const dims = createPageDimensions({
        pageSize: 'a4',
        orientation: 'portrait',
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
        headerHeight: 36,
        footerHeight: 36,
      })

      // Content height reduced by header and footer
      expect(dims.contentHeight).toBe(841.89 - 72 - 72 - 36 - 36)
      expect(dims.headerHeight).toBe(36)
      expect(dims.footerHeight).toBe(36)
    })

    it('handles custom margins', () => {
      const dims = createPageDimensions({
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 100, right: 50, bottom: 100, left: 50 },
        headerHeight: 0,
        footerHeight: 0,
      })

      expect(dims.contentWidth).toBe(612 - 50 - 50)
      expect(dims.contentHeight).toBe(792 - 100 - 100)
      expect(dims.margins).toEqual({
        top: 100,
        right: 50,
        bottom: 100,
        left: 50,
      })
    })
  })

  describe('configFromMetadata', () => {
    it('extracts pagination config from metadata', () => {
      const metadata: DocumentMetadata = {
        title: 'Test',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        pageSize: 'letter',
        orientation: 'landscape',
        margins: { top: 54, right: 54, bottom: 54, left: 54 },
      }

      const config = configFromMetadata(metadata)

      expect(config.pageSize).toBe('letter')
      expect(config.orientation).toBe('landscape')
      expect(config.margins).toEqual({
        top: 54,
        right: 54,
        bottom: 54,
        left: 54,
      })
    })

    it('adds header/footer height when present', () => {
      const metadata: DocumentMetadata = {
        title: 'Test',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        pageSize: 'a4',
        orientation: 'portrait',
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
        header: { center: '{{title}}', showOnFirstPage: true },
        footer: { center: 'Page {{pageNumber}}', showOnFirstPage: true },
      }

      const config = configFromMetadata(metadata)

      expect(config.headerHeight).toBe(36)
      expect(config.footerHeight).toBe(36)
    })

    it('sets zero heights without header/footer', () => {
      const metadata: DocumentMetadata = {
        title: 'Test',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        pageSize: 'a4',
        orientation: 'portrait',
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
      }

      const config = configFromMetadata(metadata)

      expect(config.headerHeight).toBe(0)
      expect(config.footerHeight).toBe(0)
    })
  })
})
