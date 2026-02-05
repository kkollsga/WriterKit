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

/**
 * Configuration for virtual pagination
 */
export interface VirtualPaginatorConfig {
  /** Number of pages to render above/below viewport */
  overscan: number
  /** Use IntersectionObserver for visibility detection */
  useIntersectionObserver: boolean
  /** Threshold for IntersectionObserver (0-1) */
  intersectionThreshold: number
  /** Enable page view recycling */
  recycleViews: boolean
  /** Maximum recycled views to keep */
  maxRecycledViews: number
  /** Debounce scroll events (ms) */
  scrollDebounce: number
  /** Show placeholder for off-screen pages */
  showPlaceholders: boolean
}

const DEFAULT_VIRTUAL_CONFIG: VirtualPaginatorConfig = {
  overscan: 2,
  useIntersectionObserver: true,
  intersectionThreshold: 0.1,
  recycleViews: true,
  maxRecycledViews: 10,
  scrollDebounce: 16,
  showPlaceholders: true,
}

/**
 * VirtualPaginator provides efficient rendering of large documents
 * by only rendering pages that are visible or near the viewport.
 *
 * Features:
 * - IntersectionObserver-based visibility detection
 * - Page view recycling for memory efficiency
 * - Placeholder pages for smooth scrolling
 * - Scroll position preservation during reflows
 *
 * @example
 * ```typescript
 * const virtualPaginator = new VirtualPaginator(dimensions, paginationConfig, {
 *   overscan: 3,
 *   recycleViews: true,
 * })
 *
 * virtualPaginator.setContainer(scrollContainer)
 * virtualPaginator.setPaginationModel(model)
 *
 * // Listen for visible page changes
 * virtualPaginator.onVisiblePagesChanged((pages) => {
 *   console.log('Now showing pages:', pages)
 * })
 * ```
 */
export class VirtualPaginator {
  private dimensions: PageDimensions
  private paginationConfig: PaginationConfig
  private viewOptions: PageViewOptions
  private virtualConfig: VirtualPaginatorConfig

  private container: HTMLElement | null = null
  private contentWrapper: HTMLElement | null = null

  // Page tracking
  private totalPages = 0
  private visiblePages: Set<number> = new Set()
  private renderedPages: Map<number, PageView> = new Map()
  private recycledViews: PageView[] = []
  private placeholders: Map<number, HTMLElement> = new Map()

  // Observers and timers
  private intersectionObserver: IntersectionObserver | null = null
  private resizeObserver: ResizeObserver | null = null
  private scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null

  // Scroll state (reserved for predictive pre-rendering)
  private lastScrollTop = 0
  private _isScrolling = false
  private _scrollDirection: 'up' | 'down' = 'down'

  // Callbacks
  private visiblePagesChangedCallbacks: Array<(pages: number[]) => void> = []

  constructor(
    dimensions: PageDimensions,
    paginationConfig: PaginationConfig,
    viewOptions: Partial<PageViewOptions> = {},
    virtualConfig: Partial<VirtualPaginatorConfig> = {}
  ) {
    this.dimensions = dimensions
    this.paginationConfig = paginationConfig
    this.viewOptions = { ...DEFAULT_OPTIONS, ...viewOptions }
    this.virtualConfig = { ...DEFAULT_VIRTUAL_CONFIG, ...virtualConfig }
  }

  /**
   * Set the scroll container
   */
  setContainer(container: HTMLElement): void {
    // Clean up old container
    if (this.container) {
      this.teardownObservers()
    }

    this.container = container

    // Create content wrapper for proper scroll height
    this.contentWrapper = document.createElement('div')
    this.contentWrapper.className = 'writerkit-virtual-content'
    this.contentWrapper.style.cssText = `
      position: relative;
      width: 100%;
    `
    container.appendChild(this.contentWrapper)

    this.setupObservers()
  }

  /**
   * Update dimensions when page size changes
   */
  updateDimensions(dimensions: PageDimensions): void {
    this.dimensions = dimensions
    this.updateContentHeight()
    this.rerenderVisiblePages()
  }

  /**
   * Set total page count and trigger render
   */
  setTotalPages(totalPages: number): void {
    const previousTotal = this.totalPages
    this.totalPages = totalPages

    this.updateContentHeight()

    // Create/remove placeholders as needed
    this.updatePlaceholders()

    // If page count decreased, clean up removed pages
    if (totalPages < previousTotal) {
      this.cleanupRemovedPages(totalPages)
    }

    this.updateVisiblePages()
  }

  /**
   * Render a page at the given boundary
   */
  renderPage(boundary: PageBoundary): PageView {
    const pageNum = boundary.pageNumber

    // Check if already rendered
    let view = this.renderedPages.get(pageNum)

    if (view) {
      view.update(boundary)
      return view
    }

    // Get a recycled view or create new one
    view = this.getRecycledView() ?? new PageView(
      this.dimensions,
      this.paginationConfig,
      this.viewOptions
    )

    const element = view.render(boundary)

    // Position the page
    this.positionPage(element, pageNum)

    // Add to container
    if (this.contentWrapper) {
      this.contentWrapper.appendChild(element)
    }

    // Track rendered page
    this.renderedPages.set(pageNum, view)

    // Remove placeholder if present
    this.removePlaceholder(pageNum)

    // Setup intersection observer on this page
    if (this.intersectionObserver && element) {
      this.intersectionObserver.observe(element)
    }

    return view
  }

  /**
   * Remove a rendered page
   */
  removePage(pageNumber: number): void {
    const view = this.renderedPages.get(pageNumber)
    if (!view) return

    const element = view.getElement()
    if (element && this.intersectionObserver) {
      this.intersectionObserver.unobserve(element)
    }

    // Recycle or destroy the view
    if (this.virtualConfig.recycleViews &&
        this.recycledViews.length < this.virtualConfig.maxRecycledViews) {
      // Detach from DOM but keep the view for recycling
      if (element && element.parentNode) {
        element.parentNode.removeChild(element)
      }
      this.recycledViews.push(view)
    } else {
      view.destroy()
    }

    this.renderedPages.delete(pageNumber)
    this.visiblePages.delete(pageNumber)

    // Add placeholder back
    if (this.virtualConfig.showPlaceholders) {
      this.createPlaceholder(pageNumber)
    }
  }

  /**
   * Get the currently visible page numbers
   */
  getVisiblePages(): number[] {
    return Array.from(this.visiblePages).sort((a, b) => a - b)
  }

  /**
   * Get the first visible page
   */
  getFirstVisiblePage(): number {
    const pages = this.getVisiblePages()
    return pages.length > 0 ? pages[0] : 1
  }

  /**
   * Get current scroll state for debugging/optimization
   */
  getScrollState(): { isScrolling: boolean; direction: 'up' | 'down'; scrollTop: number } {
    return {
      isScrolling: this._isScrolling,
      direction: this._scrollDirection,
      scrollTop: this.lastScrollTop,
    }
  }

  /**
   * Scroll to a specific page
   */
  scrollToPage(pageNumber: number, behavior: ScrollBehavior = 'smooth'): void {
    if (!this.container) return

    const scrollTop = this.getPageTop(pageNumber)
    this.container.scrollTo({ top: scrollTop, behavior })
  }

  /**
   * Register callback for visible pages change
   */
  onVisiblePagesChanged(callback: (pages: number[]) => void): () => void {
    this.visiblePagesChangedCallbacks.push(callback)
    return () => {
      const idx = this.visiblePagesChangedCallbacks.indexOf(callback)
      if (idx >= 0) {
        this.visiblePagesChangedCallbacks.splice(idx, 1)
      }
    }
  }

  /**
   * Preserve scroll position during reflow
   */
  preserveScrollPosition(operation: () => void): void {
    if (!this.container) {
      operation()
      return
    }

    // Save scroll position relative to first visible page
    const firstPage = this.getFirstVisiblePage()
    const pageTop = this.getPageTop(firstPage)
    const offsetFromPage = this.container.scrollTop - pageTop

    // Execute operation
    operation()

    // Restore scroll position
    requestAnimationFrame(() => {
      if (this.container) {
        const newPageTop = this.getPageTop(firstPage)
        this.container.scrollTop = newPageTop + offsetFromPage
      }
    })
  }

  /**
   * Get the height of a single page
   */
  getPageHeight(): number {
    return (
      this.dimensions.height * this.viewOptions.scale * this.paginationConfig.pixelsPerPoint +
      this.viewOptions.pageGap
    )
  }

  /**
   * Get total scroll height
   */
  getTotalHeight(): number {
    return this.getPageHeight() * this.totalPages
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.teardownObservers()

    // Destroy all rendered pages
    this.renderedPages.forEach((view) => view.destroy())
    this.renderedPages.clear()

    // Clear recycled views
    this.recycledViews.forEach((view) => view.destroy())
    this.recycledViews = []

    // Remove placeholders
    this.placeholders.forEach((el) => el.remove())
    this.placeholders.clear()

    // Remove content wrapper
    if (this.contentWrapper && this.contentWrapper.parentNode) {
      this.contentWrapper.parentNode.removeChild(this.contentWrapper)
    }
    this.contentWrapper = null
    this.container = null

    // Clear callbacks
    this.visiblePagesChangedCallbacks = []
  }

  // Private methods

  private setupObservers(): void {
    if (!this.container) return

    // Setup IntersectionObserver
    if (this.virtualConfig.useIntersectionObserver && typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver(
        this.handleIntersection.bind(this),
        {
          root: this.container,
          threshold: this.virtualConfig.intersectionThreshold,
        }
      )
    }

    // Setup ResizeObserver for container resize
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateVisiblePages()
      })
      this.resizeObserver.observe(this.container)
    }

    // Setup scroll listener
    this.container.addEventListener('scroll', this.handleScroll.bind(this), { passive: true })
  }

  private teardownObservers(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
      this.intersectionObserver = null
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }

    if (this.container) {
      this.container.removeEventListener('scroll', this.handleScroll.bind(this))
    }

    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer)
      this.scrollDebounceTimer = null
    }
  }

  private handleScroll = (): void => {
    if (!this.container) return

    const scrollTop = this.container.scrollTop
    this._scrollDirection = scrollTop > this.lastScrollTop ? 'down' : 'up'
    this.lastScrollTop = scrollTop
    this._isScrolling = true

    // Debounce scroll handling
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer)
    }

    this.scrollDebounceTimer = setTimeout(() => {
      this._isScrolling = false
      this.updateVisiblePages()
    }, this.virtualConfig.scrollDebounce)

    // Immediate update for visible pages if not using IntersectionObserver
    if (!this.virtualConfig.useIntersectionObserver) {
      this.updateVisiblePages()
    }
  }

  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    let changed = false

    for (const entry of entries) {
      const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '0', 10)
      if (pageNum === 0) continue

      if (entry.isIntersecting) {
        if (!this.visiblePages.has(pageNum)) {
          this.visiblePages.add(pageNum)
          changed = true
        }
      } else {
        if (this.visiblePages.has(pageNum)) {
          this.visiblePages.delete(pageNum)
          changed = true
        }
      }
    }

    if (changed) {
      this.notifyVisiblePagesChanged()
    }
  }

  private updateVisiblePages(): void {
    if (!this.container) return

    const scrollTop = this.container.scrollTop
    const viewportHeight = this.container.clientHeight
    const pageHeight = this.getPageHeight()

    // Calculate visible range with overscan
    const startPage = Math.max(1, Math.floor(scrollTop / pageHeight) - this.virtualConfig.overscan)
    const endPage = Math.min(
      this.totalPages,
      Math.ceil((scrollTop + viewportHeight) / pageHeight) + this.virtualConfig.overscan
    )

    // Determine pages to render and remove
    const newVisible = new Set<number>()
    for (let i = startPage; i <= endPage; i++) {
      newVisible.add(i)
    }

    // Remove pages that are no longer in range
    this.renderedPages.forEach((_, pageNum) => {
      if (!newVisible.has(pageNum)) {
        this.removePage(pageNum)
      }
    })

    // Update visible set
    const oldVisible = Array.from(this.visiblePages)
    this.visiblePages = newVisible

    // Check if changed
    const newVisibleArray = Array.from(newVisible)
    if (oldVisible.length !== newVisibleArray.length ||
        !oldVisible.every((p) => newVisible.has(p))) {
      this.notifyVisiblePagesChanged()
    }
  }

  private notifyVisiblePagesChanged(): void {
    const pages = this.getVisiblePages()
    for (const callback of this.visiblePagesChangedCallbacks) {
      callback(pages)
    }
  }

  private updateContentHeight(): void {
    if (this.contentWrapper) {
      this.contentWrapper.style.height = `${this.getTotalHeight()}px`
    }
  }

  private updatePlaceholders(): void {
    if (!this.virtualConfig.showPlaceholders) return

    // Create placeholders for pages not yet rendered
    for (let i = 1; i <= this.totalPages; i++) {
      if (!this.renderedPages.has(i) && !this.placeholders.has(i)) {
        this.createPlaceholder(i)
      }
    }

    // Remove extra placeholders
    this.placeholders.forEach((_, pageNum) => {
      if (pageNum > this.totalPages) {
        this.removePlaceholder(pageNum)
      }
    })
  }

  private createPlaceholder(pageNumber: number): void {
    if (this.placeholders.has(pageNumber) || !this.contentWrapper) return

    const placeholder = document.createElement('div')
    placeholder.className = 'writerkit-page-placeholder'
    placeholder.dataset.pageNumber = String(pageNumber)

    const width = this.dimensions.width * this.viewOptions.scale * this.paginationConfig.pixelsPerPoint
    const height = this.dimensions.height * this.viewOptions.scale * this.paginationConfig.pixelsPerPoint

    placeholder.style.cssText = `
      position: absolute;
      width: ${width}px;
      height: ${height}px;
      background: #f5f5f5;
      border: 1px dashed #ddd;
      box-sizing: border-box;
    `

    this.positionPage(placeholder, pageNumber)
    this.contentWrapper.appendChild(placeholder)
    this.placeholders.set(pageNumber, placeholder)
  }

  private removePlaceholder(pageNumber: number): void {
    const placeholder = this.placeholders.get(pageNumber)
    if (placeholder) {
      placeholder.remove()
      this.placeholders.delete(pageNumber)
    }
  }

  private positionPage(element: HTMLElement, pageNumber: number): void {
    const top = this.getPageTop(pageNumber)
    element.style.position = 'absolute'
    element.style.top = `${top}px`
    element.style.left = '50%'
    element.style.transform = 'translateX(-50%)'
  }

  private getPageTop(pageNumber: number): number {
    return (pageNumber - 1) * this.getPageHeight()
  }

  private getRecycledView(): PageView | undefined {
    return this.recycledViews.pop()
  }

  private cleanupRemovedPages(newTotal: number): void {
    const toRemove: number[] = []

    this.renderedPages.forEach((_, pageNum) => {
      if (pageNum > newTotal) {
        toRemove.push(pageNum)
      }
    })

    toRemove.forEach((pageNum) => this.removePage(pageNum))
  }

  private rerenderVisiblePages(): void {
    // Re-position all rendered pages with new dimensions
    this.renderedPages.forEach((view, pageNum) => {
      const element = view.getElement()
      if (element) {
        this.positionPage(element, pageNum)
      }
    })

    // Update placeholders
    this.placeholders.forEach((element, pageNum) => {
      this.positionPage(element, pageNum)
    })
  }
}
