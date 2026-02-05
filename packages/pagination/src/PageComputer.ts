/**
 * PageComputer - Computes page boundaries from document content
 *
 * The core algorithm:
 * 1. Measure all top-level blocks
 * 2. Find forced page breaks
 * 3. Compute page boundaries based on available space
 * 4. Handle orphan/widow control
 * 5. Split splittable blocks (tables, lists) when needed
 */

import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type {
  BlockMeasurement,
  PageBoundary,
  PageDimensions,
  PaginationConfig,
  PaginationModel,
  SplitResult,
} from './types'
import { Measurer } from './Measurer'

/**
 * PageComputer calculates page boundaries for a document.
 *
 * @example
 * ```typescript
 * const computer = new PageComputer(config, dimensions)
 * computer.setMeasurer(measurer)
 *
 * const model = computer.compute(doc)
 * console.log(`Document has ${model.pageCount} pages`)
 * ```
 */
export class PageComputer {
  private config: PaginationConfig
  private dimensions: PageDimensions
  private measurer: Measurer | null = null

  constructor(config: PaginationConfig, dimensions: PageDimensions) {
    this.config = config
    this.dimensions = dimensions
  }

  /**
   * Set the measurer instance
   */
  setMeasurer(measurer: Measurer): void {
    this.measurer = measurer
  }

  /**
   * Update dimensions (e.g., when page size changes)
   */
  setDimensions(dimensions: PageDimensions): void {
    this.dimensions = dimensions
  }

  /**
   * Compute pagination for a document
   */
  compute(doc: ProseMirrorNode): PaginationModel {
    if (!this.measurer) {
      throw new Error('Measurer not set. Call setMeasurer() first.')
    }

    // Step 1: Measure all blocks
    const measurements = this.measurer.measureDocument(doc)

    // Step 2 & 3: Compute page boundaries
    const pages = this.computePages(measurements)

    // Calculate total content height
    const totalContentHeight = measurements.reduce((sum, m) => sum + m.height, 0)

    return {
      pages,
      dimensions: this.dimensions,
      totalContentHeight,
      pageCount: pages.length,
    }
  }

  /**
   * Compute page boundaries from measurements
   */
  private computePages(measurements: BlockMeasurement[]): PageBoundary[] {
    const pages: PageBoundary[] = []
    const availableHeight = this.dimensions.contentHeight

    let currentPage: PageBoundary = this.createNewPage(1, 0, false)
    let currentHeight = 0

    for (let i = 0; i < measurements.length; i++) {
      const block = measurements[i]

      // Check for forced page break
      if (block.type === 'pageBreak') {
        // Finalize current page
        currentPage.endPos = block.pos
        currentPage.contentHeight = currentHeight
        pages.push(currentPage)

        // Start new page
        currentPage = this.createNewPage(pages.length + 1, block.pos + 1, true)
        currentHeight = 0
        continue
      }

      // Check if block fits on current page
      if (currentHeight + block.height <= availableHeight) {
        // Block fits - add it to current page
        currentPage.nodePositions.push({
          pos: block.pos,
          height: block.height,
          type: block.type,
          isPageBreak: false,
        })
        currentHeight += block.height
      } else {
        // Block doesn't fit - need to handle overflow

        // Try to split the block if it's splittable
        if (block.splittable && block.itemHeights && block.minHeight) {
          const splitResult = this.trySplitBlock(
            block,
            availableHeight - currentHeight
          )

          if (splitResult && splitResult.kept.height > 0) {
            // Add the portion that fits
            currentPage.nodePositions.push({
              pos: block.pos,
              height: splitResult.kept.height,
              type: block.type,
              isPageBreak: false,
            })
            currentHeight += splitResult.kept.height
          }
        }

        // Check orphan control - don't leave just one line on current page
        if (this.shouldPreventOrphan(currentPage, block)) {
          // Move some content to next page
          const orphanNode = currentPage.nodePositions.pop()
          if (orphanNode) {
            currentHeight -= orphanNode.height
          }
        }

        // Finalize current page
        if (currentPage.nodePositions.length > 0) {
          currentPage.endPos = this.getLastNodeEndPos(currentPage)
          currentPage.contentHeight = currentHeight
          pages.push(currentPage)
        }

        // Start new page
        currentPage = this.createNewPage(
          pages.length + 1,
          block.pos,
          false
        )
        currentHeight = 0

        // Add block to new page (may need to split if very large)
        if (block.height > availableHeight && block.splittable && block.itemHeights) {
          // Block is larger than a full page - split across multiple pages
          this.handleOversizedBlock(
            block,
            availableHeight,
            pages,
            currentPage
          )
          currentPage = pages[pages.length - 1] || currentPage
          currentHeight = currentPage.contentHeight
        } else {
          // Block fits on the new page
          currentPage.nodePositions.push({
            pos: block.pos,
            height: block.height,
            type: block.type,
            isPageBreak: false,
          })
          currentHeight = block.height
        }
      }
    }

    // Don't forget the last page
    if (currentPage.nodePositions.length > 0 || pages.length === 0) {
      currentPage.endPos = measurements.length > 0
        ? measurements[measurements.length - 1].pos + 1
        : 1
      currentPage.contentHeight = currentHeight
      pages.push(currentPage)
    }

    return pages
  }

  /**
   * Create a new page boundary
   */
  private createNewPage(
    pageNumber: number,
    startPos: number,
    forcedBreak: boolean
  ): PageBoundary {
    return {
      pageNumber,
      startPos,
      endPos: startPos,
      contentHeight: 0,
      forcedBreak,
      nodePositions: [],
    }
  }

  /**
   * Get the end position of the last node on a page
   */
  private getLastNodeEndPos(page: PageBoundary): number {
    const lastNode = page.nodePositions[page.nodePositions.length - 1]
    return lastNode ? lastNode.pos + 1 : page.startPos
  }

  /**
   * Try to split a block to fit available space
   */
  private trySplitBlock(
    block: BlockMeasurement,
    availableHeight: number
  ): SplitResult | null {
    if (!block.itemHeights || !block.minHeight) {
      return null
    }

    // For tables, keep header row on both sides
    const minKept = block.minHeight
    if (availableHeight < minKept) {
      return null // Can't even fit the minimum
    }

    let keptHeight = 0
    let keptCount = 0

    // First item (header) always kept
    if (block.itemHeights.length > 0) {
      keptHeight = block.itemHeights[0]
      keptCount = 1
    }

    // Add items while they fit
    for (let i = 1; i < block.itemHeights.length; i++) {
      const itemHeight = block.itemHeights[i]
      if (keptHeight + itemHeight <= availableHeight) {
        keptHeight += itemHeight
        keptCount++
      } else {
        break
      }
    }

    // Check widow control - don't leave just one item on next page
    const remainingCount = block.itemHeights.length - keptCount
    if (remainingCount === 1 && keptCount > 2) {
      // Move one item to next page
      keptCount--
      keptHeight -= block.itemHeights[keptCount]
    }

    const overflowHeight = block.itemHeights
      .slice(keptCount)
      .reduce((sum, h) => sum + h, 0)

    return {
      kept: {
        height: keptHeight,
        itemCount: keptCount,
      },
      overflow: {
        height: overflowHeight,
        itemCount: block.itemHeights.length - keptCount,
      },
    }
  }

  /**
   * Check if we should prevent orphan (single line at bottom of page)
   */
  private shouldPreventOrphan(page: PageBoundary, _nextBlock: BlockMeasurement): boolean {
    if (page.nodePositions.length === 0) return false

    const lastNode = page.nodePositions[page.nodePositions.length - 1]

    // If it's a short paragraph (likely single line), prevent orphan
    if (lastNode.type === 'paragraph' && lastNode.height < this.config.defaultLineHeight * 2) {
      return true
    }

    return false
  }

  /**
   * Handle a block that's larger than a full page
   */
  private handleOversizedBlock(
    block: BlockMeasurement,
    availableHeight: number,
    pages: PageBoundary[],
    currentPage: PageBoundary
  ): void {
    if (!block.itemHeights) {
      // Can't split - just put on one page and let it overflow
      currentPage.nodePositions.push({
        pos: block.pos,
        height: block.height,
        type: block.type,
        isPageBreak: false,
      })
      currentPage.contentHeight = block.height
      return
    }

    let remainingItems = block.itemHeights.slice()
    let remainingStartIndex = 0
    let currentPageRef = currentPage

    while (remainingItems.length > 0) {
      let pageHeight = 0
      let itemsOnPage = 0

      // For tables, always include header (first item) on each page
      const headerHeight = block.type === 'table' && remainingStartIndex > 0
        ? block.itemHeights[0]
        : 0

      if (headerHeight > 0) {
        pageHeight += headerHeight
      }

      // Add items that fit
      for (const height of remainingItems) {
        if (pageHeight + height <= availableHeight) {
          pageHeight += height
          itemsOnPage++
        } else {
          break
        }
      }

      // Ensure at least one item per page
      if (itemsOnPage === 0 && remainingItems.length > 0) {
        pageHeight = remainingItems[0]
        itemsOnPage = 1
      }

      // Add to current page
      currentPageRef.nodePositions.push({
        pos: block.pos,
        height: pageHeight,
        type: block.type,
        isPageBreak: false,
      })
      currentPageRef.contentHeight = pageHeight

      // Remove items we've placed
      remainingItems = remainingItems.slice(itemsOnPage)
      remainingStartIndex += itemsOnPage

      // If more items remain, create new page
      if (remainingItems.length > 0) {
        currentPageRef.endPos = block.pos
        pages.push(currentPageRef)

        currentPageRef = this.createNewPage(pages.length + 1, block.pos, false)
      }
    }
  }

  /**
   * Get the page number for a given document position
   */
  getPageForPosition(model: PaginationModel, pos: number): number {
    for (const page of model.pages) {
      if (pos >= page.startPos && pos < page.endPos) {
        return page.pageNumber
      }
    }
    // Default to last page
    return model.pageCount
  }

  /**
   * Get the page boundary for a page number
   */
  getPage(model: PaginationModel, pageNumber: number): PageBoundary | null {
    return model.pages.find((p) => p.pageNumber === pageNumber) ?? null
  }

  /**
   * Compute only from a specific position forward (for incremental updates)
   */
  computeFrom(
    doc: ProseMirrorNode,
    existingModel: PaginationModel,
    fromPos: number
  ): PaginationModel {
    if (!this.measurer) {
      throw new Error('Measurer not set. Call setMeasurer() first.')
    }

    // Find the page that contains fromPos
    let pageIndex = 0
    for (let i = 0; i < existingModel.pages.length; i++) {
      if (existingModel.pages[i].startPos <= fromPos) {
        pageIndex = i
      } else {
        break
      }
    }

    // Keep pages before the change
    const keptPages = existingModel.pages.slice(0, pageIndex)

    // Re-measure from the change point forward
    const measurements = this.measurer.measureDocument(doc)

    // Find measurements from the change point
    const startMeasurementIndex = measurements.findIndex(
      (m) => m.pos >= fromPos
    )

    if (startMeasurementIndex === -1) {
      // No measurements after this point
      return existingModel
    }

    // Compute pages for the remaining measurements
    const remainingMeasurements = measurements.slice(startMeasurementIndex)
    const newPages = this.computePages(remainingMeasurements)

    // Renumber new pages
    const startPageNumber = keptPages.length + 1
    newPages.forEach((page, i) => {
      page.pageNumber = startPageNumber + i
    })

    // Combine kept and new pages
    const allPages = [...keptPages, ...newPages]

    // Calculate total content height
    const totalContentHeight = measurements.reduce((sum, m) => sum + m.height, 0)

    return {
      pages: allPages,
      dimensions: this.dimensions,
      totalContentHeight,
      pageCount: allPages.length,
    }
  }
}
