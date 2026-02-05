/**
 * Measurer - Block measurement for pagination
 *
 * Responsible for measuring the height of document blocks/nodes
 * for pagination calculations. Supports both DOM-based measurement
 * and estimation when DOM is not available.
 */

import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorView } from 'prosemirror-view'
import type {
  BlockMeasurement,
  PaginationConfig,
  PageDimensions,
} from './types'

/**
 * Cache entry for a measured block
 */
interface MeasurementCacheEntry {
  /** Measured height in points */
  height: number
  /** Hash of the node content for cache invalidation */
  contentHash: string
  /** Timestamp when measured */
  measuredAt: number
  /** Last access time for LRU eviction */
  lastAccessedAt: number
}

/**
 * Cache statistics for performance monitoring
 */
interface CacheStatistics {
  /** Total cache hits */
  hits: number
  /** Total cache misses */
  misses: number
  /** Current cache size */
  size: number
  /** Cache hit rate (0-1) */
  hitRate: number
}

/**
 * Default maximum cache entries before LRU eviction
 */
const DEFAULT_MAX_CACHE_SIZE = 500

/**
 * Measurer handles measuring block heights for pagination.
 *
 * It provides two modes:
 * 1. DOM measurement - accurate but requires rendered content
 * 2. Estimation - fast approximation based on content analysis
 *
 * Measurements are cached and invalidated when content changes.
 *
 * @example
 * ```typescript
 * const measurer = new Measurer(config, dimensions)
 *
 * // Measure with DOM (accurate)
 * measurer.setView(editorView)
 * const blocks = measurer.measureDocument(doc)
 *
 * // Estimate without DOM (fast)
 * const estimated = measurer.estimateNodeHeight(node)
 * ```
 */
export class Measurer {
  private config: PaginationConfig
  private dimensions: PageDimensions
  private view: EditorView | null = null
  private cache: Map<number, MeasurementCacheEntry> = new Map()
  private maxCacheSize: number

  // Cache statistics
  private cacheHits = 0
  private cacheMisses = 0

  constructor(config: PaginationConfig, dimensions: PageDimensions, maxCacheSize = DEFAULT_MAX_CACHE_SIZE) {
    this.config = config
    this.dimensions = dimensions
    this.maxCacheSize = maxCacheSize
  }

  /**
   * Set the editor view for DOM-based measurement
   */
  setView(view: EditorView): void {
    this.view = view
  }

  /**
   * Update dimensions (e.g., when page size changes)
   */
  setDimensions(dimensions: PageDimensions): void {
    this.dimensions = dimensions
    // Clear cache when dimensions change as measurements may differ
    this.cache.clear()
  }

  /**
   * Measure all top-level blocks in the document
   */
  measureDocument(doc: ProseMirrorNode): BlockMeasurement[] {
    const measurements: BlockMeasurement[] = []
    let pos = 0

    doc.forEach((node, offset) => {
      const nodePos = pos + offset + 1 // +1 for doc node itself
      const measurement = this.measureNode(node, nodePos)
      measurements.push(measurement)
    })

    return measurements
  }

  /**
   * Measure a single node
   */
  measureNode(node: ProseMirrorNode, pos: number): BlockMeasurement {
    // Check if this is a page break
    if (node.type.name === 'pageBreak') {
      return {
        pos,
        type: 'pageBreak',
        height: 0,
        splittable: false,
      }
    }

    // Try to get from cache
    const cached = this.getCached(pos, node)
    if (cached !== null) {
      return {
        pos,
        type: node.type.name,
        height: cached,
        splittable: this.isSplittable(node),
        minHeight: this.getMinHeight(node),
        itemHeights: this.getItemHeights(node),
      }
    }

    // Measure via DOM if available
    let height: number
    if (this.view) {
      height = this.measureNodeDOM(node, pos)
    } else {
      height = this.estimateNodeHeight(node)
    }

    // Cache the measurement
    this.setCached(pos, node, height)

    return {
      pos,
      type: node.type.name,
      height,
      splittable: this.isSplittable(node),
      minHeight: this.getMinHeight(node),
      itemHeights: this.getItemHeights(node),
    }
  }

  /**
   * Measure a node using the DOM
   */
  private measureNodeDOM(node: ProseMirrorNode, pos: number): number {
    if (!this.view) {
      return this.estimateNodeHeight(node)
    }

    try {
      // Get the DOM node for this position
      const domNode = this.view.nodeDOM(pos)
      if (domNode instanceof HTMLElement) {
        // Get computed height in pixels
        const rect = domNode.getBoundingClientRect()
        const heightPx = rect.height

        // Convert pixels to points
        return heightPx / this.config.pixelsPerPoint
      }
    } catch {
      // Fall back to estimation if DOM measurement fails
    }

    return this.estimateNodeHeight(node)
  }

  /**
   * Estimate node height without DOM access
   *
   * This is used for:
   * - Initial layout before render
   * - Nodes that are virtualized (off-screen)
   * - Server-side rendering
   */
  estimateNodeHeight(node: ProseMirrorNode): number {
    const type = node.type.name

    switch (type) {
      case 'paragraph':
        return this.estimateParagraphHeight(node)
      case 'heading':
        return this.estimateHeadingHeight(node)
      case 'codeBlock':
        return this.estimateCodeBlockHeight(node)
      case 'blockquote':
        return this.estimateBlockquoteHeight(node)
      case 'bulletList':
      case 'orderedList':
        return this.estimateListHeight(node)
      case 'table':
        return this.estimateTableHeight(node)
      case 'image':
        return this.estimateImageHeight(node)
      case 'horizontalRule':
        return 20 // Fixed height for HR
      case 'pageBreak':
        return 0
      default:
        // Generic estimation based on text content
        return this.estimateGenericHeight(node)
    }
  }

  /**
   * Estimate paragraph height
   */
  private estimateParagraphHeight(node: ProseMirrorNode): number {
    const text = node.textContent
    const charsPerLine = Math.floor(this.dimensions.contentWidth / 7) // ~7pt per char
    const lines = Math.ceil(text.length / charsPerLine) || 1
    const lineHeight = this.config.defaultLineHeight
    const marginBottom = 12 // Default paragraph margin

    return lines * lineHeight + marginBottom
  }

  /**
   * Estimate heading height
   */
  private estimateHeadingHeight(node: ProseMirrorNode): number {
    const level = node.attrs.level ?? 1
    // Heading sizes: h1=24pt, h2=20pt, h3=16pt, etc.
    const fontSize = Math.max(12, 28 - level * 4)
    const lineHeight = fontSize * 1.2
    const marginTop = fontSize * 0.5
    const marginBottom = fontSize * 0.3

    const text = node.textContent
    const charsPerLine = Math.floor(this.dimensions.contentWidth / (fontSize * 0.6))
    const lines = Math.ceil(text.length / charsPerLine) || 1

    return lines * lineHeight + marginTop + marginBottom
  }

  /**
   * Estimate code block height
   */
  private estimateCodeBlockHeight(node: ProseMirrorNode): number {
    const text = node.textContent
    const lines = (text.match(/\n/g) || []).length + 1
    const lineHeight = 16 // Monospace line height
    const padding = 24 // Top + bottom padding

    return lines * lineHeight + padding
  }

  /**
   * Estimate blockquote height
   */
  private estimateBlockquoteHeight(node: ProseMirrorNode): number {
    // Recursively estimate children
    let height = 0
    node.forEach((child) => {
      height += this.estimateNodeHeight(child)
    })
    // Add padding/margin for blockquote styling
    return height + 16
  }

  /**
   * Estimate list height
   */
  private estimateListHeight(node: ProseMirrorNode): number {
    let height = 0
    node.forEach((listItem) => {
      // Each list item contains block content
      let itemHeight = 0
      listItem.forEach((child) => {
        itemHeight += this.estimateNodeHeight(child)
      })
      height += Math.max(itemHeight, this.config.defaultLineHeight)
    })
    return height
  }

  /**
   * Estimate table height
   */
  private estimateTableHeight(node: ProseMirrorNode): number {
    const rowHeight = 30 // Default row height
    let rowCount = 0

    node.forEach((row) => {
      if (row.type.name === 'tableRow') {
        rowCount++
      }
    })

    // Add border/padding
    return rowCount * rowHeight + 4
  }

  /**
   * Estimate image height
   */
  private estimateImageHeight(node: ProseMirrorNode): number {
    // Use explicit height if available
    if (node.attrs.height) {
      return Number(node.attrs.height) / this.config.pixelsPerPoint
    }
    // Default image height estimation
    return 200
  }

  /**
   * Generic height estimation for unknown node types
   */
  private estimateGenericHeight(node: ProseMirrorNode): number {
    const text = node.textContent
    if (!text) return this.config.defaultLineHeight

    const charsPerLine = Math.floor(this.dimensions.contentWidth / 7)
    const lines = Math.ceil(text.length / charsPerLine) || 1
    return lines * this.config.defaultLineHeight + 12
  }

  /**
   * Check if a node type can be split across pages
   */
  private isSplittable(node: ProseMirrorNode): boolean {
    const type = node.type.name
    // Tables and lists can potentially be split
    return type === 'table' || type === 'bulletList' || type === 'orderedList'
  }

  /**
   * Get minimum height for a splittable node
   * (e.g., header row height for tables)
   */
  private getMinHeight(node: ProseMirrorNode): number | undefined {
    if (node.type.name === 'table') {
      // Minimum is one header row
      const firstRow = node.firstChild
      if (firstRow) {
        return 30 // Header row height
      }
    }
    return undefined
  }

  /**
   * Get individual item heights for splittable nodes
   */
  private getItemHeights(node: ProseMirrorNode): number[] | undefined {
    if (node.type.name === 'table') {
      const heights: number[] = []
      node.forEach((_row) => {
        heights.push(30) // Each row height
      })
      return heights
    }

    if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
      const heights: number[] = []
      node.forEach((item) => {
        let itemHeight = 0
        item.forEach((child) => {
          itemHeight += this.estimateNodeHeight(child)
        })
        heights.push(Math.max(itemHeight, this.config.defaultLineHeight))
      })
      return heights
    }

    return undefined
  }

  /**
   * Generate a hash for cache invalidation
   */
  private getContentHash(node: ProseMirrorNode): string {
    // Simple hash based on text content and structure
    const text = node.textContent
    const type = node.type.name
    const childCount = node.childCount
    return `${type}:${childCount}:${text.length}:${text.slice(0, 50)}`
  }

  /**
   * Get cached measurement if valid
   */
  private getCached(pos: number, node: ProseMirrorNode): number | null {
    const entry = this.cache.get(pos)
    if (!entry) {
      this.cacheMisses++
      return null
    }

    const hash = this.getContentHash(node)
    if (entry.contentHash !== hash) {
      // Content changed, invalidate cache
      this.cache.delete(pos)
      this.cacheMisses++
      return null
    }

    // Update LRU timestamp
    entry.lastAccessedAt = Date.now()
    this.cacheHits++

    return entry.height
  }

  /**
   * Store measurement in cache
   */
  private setCached(pos: number, node: ProseMirrorNode, height: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLRU()
    }

    const now = Date.now()
    this.cache.set(pos, {
      height,
      contentHash: this.getContentHash(node),
      measuredAt: now,
      lastAccessedAt: now,
    })
  }

  /**
   * Evict least recently used cache entries
   */
  private evictLRU(): void {
    // Find and remove oldest 10% of entries
    const entriesToRemove = Math.max(1, Math.floor(this.cache.size * 0.1))
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt)

    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  /**
   * Invalidate cache entries in a range
   */
  invalidateRange(from: number, to: number): void {
    for (const [pos] of this.cache) {
      if (pos >= from && pos <= to) {
        this.cache.delete(pos)
      }
    }
  }

  /**
   * Clear all cached measurements
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics (for debugging)
   */
  getCacheStats(): CacheStatistics {
    const total = this.cacheHits + this.cacheMisses
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      size: this.cache.size,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    }
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.cacheHits = 0
    this.cacheMisses = 0
  }

  /**
   * Batch measure multiple nodes efficiently
   * Minimizes DOM reads by batching measurement
   */
  measureNodes(nodes: Array<{ node: ProseMirrorNode; pos: number }>): BlockMeasurement[] {
    // First pass: collect nodes that need DOM measurement
    const needsDOMMeasurement: Array<{ node: ProseMirrorNode; pos: number; index: number }> = []
    const results: BlockMeasurement[] = []

    nodes.forEach(({ node, pos }, index) => {
      // Check cache first
      const cached = this.getCached(pos, node)
      if (cached !== null) {
        results[index] = {
          pos,
          type: node.type.name,
          height: cached,
          splittable: this.isSplittable(node),
          minHeight: this.getMinHeight(node),
          itemHeights: this.getItemHeights(node),
        }
      } else {
        needsDOMMeasurement.push({ node, pos, index })
        // Placeholder
        results[index] = null as unknown as BlockMeasurement
      }
    })

    // Second pass: batch DOM measurements
    if (needsDOMMeasurement.length > 0 && this.view) {
      // Force layout once before measuring
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      this.view.dom.offsetHeight

      for (const { node, pos, index } of needsDOMMeasurement) {
        const height = this.measureNodeDOM(node, pos)
        this.setCached(pos, node, height)

        results[index] = {
          pos,
          type: node.type.name,
          height,
          splittable: this.isSplittable(node),
          minHeight: this.getMinHeight(node),
          itemHeights: this.getItemHeights(node),
        }
      }
    } else if (needsDOMMeasurement.length > 0) {
      // No view, use estimation
      for (const { node, pos, index } of needsDOMMeasurement) {
        const height = this.estimateNodeHeight(node)
        this.setCached(pos, node, height)

        results[index] = {
          pos,
          type: node.type.name,
          height,
          splittable: this.isSplittable(node),
          minHeight: this.getMinHeight(node),
          itemHeights: this.getItemHeights(node),
        }
      }
    }

    return results
  }
}
