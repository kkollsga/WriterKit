/**
 * LineMeasurer - Measures individual lines within DOM elements
 *
 * Uses getClientRects() to identify line boundaries within text content,
 * enabling Word-like line-level pagination where paragraphs can be split
 * across pages at natural line breaks.
 */

import type { PaginationConfig } from './types'

/**
 * Represents a single line of text within a block
 */
export interface LineMeasurement {
  /** Index of this line within the block (0-based) */
  index: number
  /** Height of this line in pixels */
  height: number
  /** Top position relative to block start */
  top: number
  /** Bottom position relative to block start */
  bottom: number
  /** Whether this is the first line of a paragraph */
  isFirst: boolean
  /** Whether this is the last line of a paragraph */
  isLast: boolean
}

/**
 * Result of measuring lines within a block element
 */
export interface BlockLineMeasurement {
  /** Total number of lines */
  lineCount: number
  /** Individual line measurements */
  lines: LineMeasurement[]
  /** Total block height in pixels */
  totalHeight: number
  /** Whether this block can be split at line boundaries */
  splittableAtLine: boolean
}

/**
 * LineMeasurer provides line-level measurement for DOM elements.
 *
 * This enables Word-like pagination where:
 * - Paragraphs can be split across pages at line breaks
 * - Widow/orphan control works at the line level
 * - Page space is utilized more efficiently
 *
 * @example
 * ```typescript
 * const measurer = new LineMeasurer(config)
 * const element = document.querySelector('p')
 * const lines = measurer.measureLines(element)
 *
 * console.log(`Paragraph has ${lines.lineCount} lines`)
 * lines.lines.forEach(line => {
 *   console.log(`Line ${line.index}: ${line.height}px`)
 * })
 * ```
 */
export class LineMeasurer {
  private config: PaginationConfig

  constructor(config: PaginationConfig) {
    this.config = config
  }

  /**
   * Measure individual lines within a block element
   *
   * Uses getClientRects() on text nodes to identify line boundaries.
   * Falls back to treating the entire block as a single line for
   * non-text or complex elements.
   */
  measureLines(element: HTMLElement): BlockLineMeasurement {
    const blockRect = element.getBoundingClientRect()

    // For empty elements, return single line
    if (!element.textContent?.trim()) {
      return {
        lineCount: 1,
        lines: [{
          index: 0,
          height: blockRect.height,
          top: 0,
          bottom: blockRect.height,
          isFirst: true,
          isLast: true,
        }],
        totalHeight: blockRect.height,
        splittableAtLine: false,
      }
    }

    // Get all text nodes and their rects
    const lineRects = this.getLineRects(element, blockRect.top)

    // If we couldn't identify lines, treat as single block
    if (lineRects.length === 0) {
      return {
        lineCount: 1,
        lines: [{
          index: 0,
          height: blockRect.height,
          top: 0,
          bottom: blockRect.height,
          isFirst: true,
          isLast: true,
        }],
        totalHeight: blockRect.height,
        splittableAtLine: false,
      }
    }

    // Convert rects to line measurements
    const lines: LineMeasurement[] = lineRects.map((rect, index) => ({
      index,
      height: rect.height,
      top: rect.top,
      bottom: rect.bottom,
      isFirst: index === 0,
      isLast: index === lineRects.length - 1,
    }))

    return {
      lineCount: lines.length,
      lines,
      totalHeight: blockRect.height,
      splittableAtLine: lines.length > 1,
    }
  }

  /**
   * Get deduplicated line rects from an element's text content
   */
  private getLineRects(element: HTMLElement, blockTop: number): Array<{
    top: number
    bottom: number
    height: number
  }> {
    const textNodes = this.getTextNodes(element)
    const allRects: DOMRect[] = []

    // Collect all rects from text nodes
    for (const node of textNodes) {
      const range = document.createRange()
      range.selectNodeContents(node)
      const rects = range.getClientRects()

      for (let i = 0; i < rects.length; i++) {
        allRects.push(rects[i])
      }
    }

    // Also check for inline elements that might create lines
    const inlineElements = element.querySelectorAll('br, img, span, a, strong, em, code')
    inlineElements.forEach(el => {
      const rect = el.getBoundingClientRect()
      if (rect.height > 0) {
        allRects.push(rect)
      }
    })

    // Deduplicate rects by vertical position (same line = same top)
    const lineMap = new Map<number, { top: number; bottom: number; height: number }>()
    const tolerance = 2 // pixels tolerance for same-line detection

    for (const rect of allRects) {
      if (rect.height === 0) continue

      const relativeTop = rect.top - blockTop
      const relativeBottom = rect.bottom - blockTop

      // Find if this rect belongs to an existing line
      let foundLine = false
      for (const [lineTop, lineData] of lineMap) {
        if (Math.abs(relativeTop - lineTop) < tolerance) {
          // Same line - extend if needed
          lineData.bottom = Math.max(lineData.bottom, relativeBottom)
          lineData.height = lineData.bottom - lineData.top
          foundLine = true
          break
        }
      }

      if (!foundLine) {
        lineMap.set(relativeTop, {
          top: relativeTop,
          bottom: relativeBottom,
          height: relativeBottom - relativeTop,
        })
      }
    }

    // Sort by top position and return
    return Array.from(lineMap.values()).sort((a, b) => a.top - b.top)
  }

  /**
   * Get all text nodes within an element
   */
  private getTextNodes(element: Node): Text[] {
    const textNodes: Text[] = []
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    )

    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.trim()) {
        textNodes.push(node)
      }
    }

    return textNodes
  }

  /**
   * Calculate the optimal split point for a block given available space
   *
   * Returns the number of lines that fit, respecting widow/orphan rules.
   *
   * @param lines - Line measurements from measureLines()
   * @param availableHeight - Available height on current page in pixels
   * @returns Number of lines to keep on current page (0 = move entire block)
   */
  calculateSplitPoint(
    lines: BlockLineMeasurement,
    availableHeight: number
  ): {
    keepLines: number
    keepHeight: number
    overflowLines: number
    overflowHeight: number
  } {
    if (!lines.splittableAtLine || lines.lineCount <= 1) {
      // Can't split - either keep all or move all
      if (lines.totalHeight <= availableHeight) {
        return {
          keepLines: lines.lineCount,
          keepHeight: lines.totalHeight,
          overflowLines: 0,
          overflowHeight: 0,
        }
      } else {
        return {
          keepLines: 0,
          keepHeight: 0,
          overflowLines: lines.lineCount,
          overflowHeight: lines.totalHeight,
        }
      }
    }

    // Find how many lines fit
    let fittingLines = 0
    let fittingHeight = 0

    for (const line of lines.lines) {
      if (line.bottom <= availableHeight) {
        fittingLines++
        fittingHeight = line.bottom
      } else {
        break
      }
    }

    // Apply orphan control (minimum lines at bottom of page)
    const minOrphans = this.config.orphanLines
    if (fittingLines > 0 && fittingLines < minOrphans) {
      // Not enough lines to avoid orphans - move entire block
      return {
        keepLines: 0,
        keepHeight: 0,
        overflowLines: lines.lineCount,
        overflowHeight: lines.totalHeight,
      }
    }

    // Apply widow control (minimum lines at top of next page)
    const minWidows = this.config.widowLines
    const overflowLines = lines.lineCount - fittingLines
    if (overflowLines > 0 && overflowLines < minWidows) {
      // Would create widows - move more lines to next page
      const linesToMove = minWidows - overflowLines
      fittingLines = Math.max(0, fittingLines - linesToMove)

      if (fittingLines < minOrphans) {
        // Can't satisfy both constraints - move entire block
        return {
          keepLines: 0,
          keepHeight: 0,
          overflowLines: lines.lineCount,
          overflowHeight: lines.totalHeight,
        }
      }

      // Recalculate fitting height
      if (fittingLines > 0) {
        fittingHeight = lines.lines[fittingLines - 1].bottom
      } else {
        fittingHeight = 0
      }
    }

    const actualOverflowLines = lines.lineCount - fittingLines
    const overflowHeight = actualOverflowLines > 0
      ? lines.totalHeight - fittingHeight
      : 0

    return {
      keepLines: fittingLines,
      keepHeight: fittingHeight,
      overflowLines: actualOverflowLines,
      overflowHeight,
    }
  }

  /**
   * Check if an element type is splittable at line boundaries
   */
  isSplittableType(nodeType: string): boolean {
    // Paragraphs and list items can be split
    const splittable = ['paragraph', 'listItem', 'blockquote']
    return splittable.includes(nodeType)
  }
}
