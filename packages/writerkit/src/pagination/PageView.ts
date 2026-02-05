/**
 * PageView - Visual representation of a page
 *
 * PageView renders a single page in the paginated document view.
 * It handles:
 * - Page chrome (shadow, border)
 * - Content clipping to page boundaries
 * - Header/footer rendering
 * - Page number display
 */

import type {
  PageBoundary,
  PageDimensions,
  PaginationConfig,
} from './types'

/**
 * Options for PageView rendering
 */
export interface PageViewOptions {
  /** Show page shadow */
  showShadow: boolean
  /** Show page number */
  showPageNumber: boolean
  /** Page number position */
  pageNumberPosition: 'header' | 'footer'
  /** Gap between pages in pixels */
  pageGap: number
  /** Scale factor for display */
  scale: number
  /** CSS class prefix */
  classPrefix: string
}

const DEFAULT_OPTIONS: PageViewOptions = {
  showShadow: true,
  showPageNumber: true,
  pageNumberPosition: 'footer',
  pageGap: 20,
  scale: 1,
  classPrefix: 'writerkit-page',
}

/**
 * PageView renders a single page with its chrome and content area.
 *
 * @example
 * ```typescript
 * const pageView = new PageView(dimensions, config)
 * const element = pageView.render(pageBoundary)
 * container.appendChild(element)
 *
 * // Update when page changes
 * pageView.update(newBoundary)
 * ```
 */
export class PageView {
  private dimensions: PageDimensions
  private config: PaginationConfig
  private options: PageViewOptions
  private element: HTMLElement | null = null
  private contentElement: HTMLElement | null = null
  private boundary: PageBoundary | null = null

  constructor(
    dimensions: PageDimensions,
    config: PaginationConfig,
    options: Partial<PageViewOptions> = {}
  ) {
    this.dimensions = dimensions
    this.config = config
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Create the page element
   */
  render(boundary: PageBoundary): HTMLElement {
    this.boundary = boundary

    // Create page container
    const page = document.createElement('div')
    page.className = `${this.options.classPrefix}`
    page.dataset.pageNumber = String(boundary.pageNumber)

    // Apply page dimensions
    const width = this.dimensions.width * this.options.scale * this.config.pixelsPerPoint
    const height = this.dimensions.height * this.options.scale * this.config.pixelsPerPoint

    page.style.cssText = `
      width: ${width}px;
      height: ${height}px;
      position: relative;
      background: white;
      margin-bottom: ${this.options.pageGap}px;
      box-sizing: border-box;
      overflow: hidden;
    `

    if (this.options.showShadow) {
      page.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)'
    }

    // Create content area
    const content = document.createElement('div')
    content.className = `${this.options.classPrefix}-content`

    const margins = this.dimensions.margins
    const contentTop = (margins.top + this.dimensions.headerHeight) * this.options.scale * this.config.pixelsPerPoint
    const contentLeft = margins.left * this.options.scale * this.config.pixelsPerPoint
    const contentWidth = this.dimensions.contentWidth * this.options.scale * this.config.pixelsPerPoint
    const contentHeight = this.dimensions.contentHeight * this.options.scale * this.config.pixelsPerPoint

    content.style.cssText = `
      position: absolute;
      top: ${contentTop}px;
      left: ${contentLeft}px;
      width: ${contentWidth}px;
      height: ${contentHeight}px;
      overflow: hidden;
    `

    page.appendChild(content)
    this.contentElement = content

    // Add header if present
    if (this.dimensions.headerHeight > 0) {
      const header = this.createHeader(boundary)
      page.appendChild(header)
    }

    // Add footer if present
    if (this.dimensions.footerHeight > 0) {
      const footer = this.createFooter(boundary)
      page.appendChild(footer)
    }

    // Add page number if enabled
    if (this.options.showPageNumber && this.dimensions.footerHeight === 0) {
      const pageNum = this.createPageNumber(boundary)
      page.appendChild(pageNum)
    }

    this.element = page
    return page
  }

  /**
   * Create header element
   */
  private createHeader(_boundary: PageBoundary): HTMLElement {
    const header = document.createElement('div')
    header.className = `${this.options.classPrefix}-header`

    const margins = this.dimensions.margins
    const headerHeight = this.dimensions.headerHeight * this.options.scale * this.config.pixelsPerPoint
    const headerTop = margins.top * this.options.scale * this.config.pixelsPerPoint
    const headerLeft = margins.left * this.options.scale * this.config.pixelsPerPoint
    const headerWidth = this.dimensions.contentWidth * this.options.scale * this.config.pixelsPerPoint

    header.style.cssText = `
      position: absolute;
      top: ${headerTop}px;
      left: ${headerLeft}px;
      width: ${headerWidth}px;
      height: ${headerHeight}px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${10 * this.options.scale}px;
      color: #666;
      border-bottom: 1px solid #eee;
    `

    return header
  }

  /**
   * Create footer element
   */
  private createFooter(boundary: PageBoundary): HTMLElement {
    const footer = document.createElement('div')
    footer.className = `${this.options.classPrefix}-footer`

    const margins = this.dimensions.margins
    const footerHeight = this.dimensions.footerHeight * this.options.scale * this.config.pixelsPerPoint
    const footerBottom = margins.bottom * this.options.scale * this.config.pixelsPerPoint
    const footerLeft = margins.left * this.options.scale * this.config.pixelsPerPoint
    const footerWidth = this.dimensions.contentWidth * this.options.scale * this.config.pixelsPerPoint

    footer.style.cssText = `
      position: absolute;
      bottom: ${footerBottom}px;
      left: ${footerLeft}px;
      width: ${footerWidth}px;
      height: ${footerHeight}px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${10 * this.options.scale}px;
      color: #666;
      border-top: 1px solid #eee;
    `

    // Add page number in footer
    if (this.options.showPageNumber) {
      footer.textContent = `Page ${boundary.pageNumber}`
    }

    return footer
  }

  /**
   * Create standalone page number element
   */
  private createPageNumber(boundary: PageBoundary): HTMLElement {
    const pageNum = document.createElement('div')
    pageNum.className = `${this.options.classPrefix}-page-number`

    const margins = this.dimensions.margins
    const bottom = (margins.bottom / 2) * this.options.scale * this.config.pixelsPerPoint

    pageNum.style.cssText = `
      position: absolute;
      bottom: ${bottom}px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: ${10 * this.options.scale}px;
      color: #999;
    `

    pageNum.textContent = String(boundary.pageNumber)

    return pageNum
  }

  /**
   * Get the page element
   */
  getElement(): HTMLElement | null {
    return this.element
  }

  /**
   * Get the content element (where editor content goes)
   */
  getContentElement(): HTMLElement | null {
    return this.contentElement
  }

  /**
   * Get the current page boundary
   */
  getBoundary(): PageBoundary | null {
    return this.boundary
  }

  /**
   * Update the page with new boundary
   */
  update(boundary: PageBoundary): void {
    this.boundary = boundary

    if (this.element) {
      this.element.dataset.pageNumber = String(boundary.pageNumber)

      // Update page number display
      const pageNumEl = this.element.querySelector(
        `.${this.options.classPrefix}-page-number`
      )
      if (pageNumEl) {
        pageNumEl.textContent = String(boundary.pageNumber)
      }

      // Update footer page number
      const footerEl = this.element.querySelector(
        `.${this.options.classPrefix}-footer`
      )
      if (footerEl && this.options.showPageNumber) {
        footerEl.textContent = `Page ${boundary.pageNumber}`
      }
    }
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    if (this.element) {
      this.element.style.display = visible ? 'block' : 'none'
    }
  }

  /**
   * Check if visible
   */
  isVisible(): boolean {
    return this.element?.style.display !== 'none'
  }

  /**
   * Get page height including gap
   */
  getTotalHeight(): number {
    const height = this.dimensions.height * this.options.scale * this.config.pixelsPerPoint
    return height + this.options.pageGap
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
    this.element = null
    this.contentElement = null
    this.boundary = null
  }
}

/**
 * PageViewManager manages multiple PageView instances
 * for virtualized rendering of large documents.
 */
export class PageViewManager {
  private dimensions: PageDimensions
  private config: PaginationConfig
  private options: PageViewOptions
  private container: HTMLElement | null = null
  private pageViews: Map<number, PageView> = new Map()

  // Virtual rendering state
  private visibleRange = { start: 1, end: 1 }
  private buffer = 2 // Render buffer pages above/below viewport

  constructor(
    dimensions: PageDimensions,
    config: PaginationConfig,
    options: Partial<PageViewOptions> = {}
  ) {
    this.dimensions = dimensions
    this.config = config
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Set the container element
   */
  setContainer(container: HTMLElement): void {
    this.container = container
  }

  /**
   * Update which pages are visible based on scroll position
   */
  updateVisiblePages(
    scrollTop: number,
    viewportHeight: number,
    totalPages: number
  ): void {
    const pageHeight = this.getPageHeight()

    // Calculate visible page range
    const startPage = Math.max(1, Math.floor(scrollTop / pageHeight) - this.buffer)
    const endPage = Math.min(
      totalPages,
      Math.ceil((scrollTop + viewportHeight) / pageHeight) + this.buffer
    )

    this.visibleRange = { start: startPage, end: endPage }

    // Show/hide pages based on visibility
    this.pageViews.forEach((view, pageNum) => {
      const isVisible = pageNum >= startPage && pageNum <= endPage
      view.setVisible(isVisible)
    })
  }

  /**
   * Get or create a PageView for a page number
   */
  getPageView(pageNumber: number): PageView {
    let view = this.pageViews.get(pageNumber)

    if (!view) {
      view = new PageView(this.dimensions, this.config, this.options)
      this.pageViews.set(pageNumber, view)
    }

    return view
  }

  /**
   * Render a page and add to container
   */
  renderPage(boundary: PageBoundary): PageView {
    const view = this.getPageView(boundary.pageNumber)

    if (!view.getElement()) {
      const element = view.render(boundary)
      if (this.container) {
        this.container.appendChild(element)
      }
    } else {
      view.update(boundary)
    }

    return view
  }

  /**
   * Remove pages that are no longer needed
   */
  prunePages(keepPages: Set<number>): void {
    const toRemove: number[] = []

    this.pageViews.forEach((view, pageNum) => {
      if (!keepPages.has(pageNum)) {
        view.destroy()
        toRemove.push(pageNum)
      }
    })

    toRemove.forEach((pageNum) => this.pageViews.delete(pageNum))
  }

  /**
   * Get the height of a single page including gap
   */
  private getPageHeight(): number {
    return (
      this.dimensions.height * this.options.scale * this.config.pixelsPerPoint +
      this.options.pageGap
    )
  }

  /**
   * Get total scroll height for all pages
   */
  getTotalHeight(pageCount: number): number {
    return this.getPageHeight() * pageCount
  }

  /**
   * Scroll to a specific page
   */
  scrollToPage(pageNumber: number): void {
    if (!this.container) return

    const pageHeight = this.getPageHeight()
    const scrollTop = (pageNumber - 1) * pageHeight

    this.container.scrollTo({
      top: scrollTop,
      behavior: 'smooth',
    })
  }

  /**
   * Get the currently visible page numbers
   */
  getVisibleRange(): { start: number; end: number } {
    return { ...this.visibleRange }
  }

  /**
   * Clean up all page views
   */
  destroy(): void {
    this.pageViews.forEach((view) => view.destroy())
    this.pageViews.clear()
    this.container = null
  }
}
