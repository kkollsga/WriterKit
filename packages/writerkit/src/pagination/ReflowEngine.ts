/**
 * ReflowEngine - Handles incremental document reflow
 *
 * The ReflowEngine manages pagination updates in response to document changes.
 * It implements:
 * - Debounced updates to avoid excessive computation
 * - Incremental reflow from the point of change
 * - Event notifications for page changes
 */

import type { EditorView } from 'prosemirror-view'
import type { Transaction } from 'prosemirror-state'
import type {
  PaginationConfig,
  PaginationModel,
  PageDimensions,
  ReflowChange,
  PosRange,
  PageSpacer,
  VisualPaginationModel,
} from './types'
import { PageComputer } from './PageComputer'
import { Measurer } from './Measurer'
import { DEFAULT_PAGINATION_CONFIG, createPageDimensions } from './types'

/**
 * Event handler types
 */
type ReflowStartHandler = () => void
type ReflowEndHandler = (model: PaginationModel) => void
type PagesChangedHandler = (model: PaginationModel) => void

/**
 * ReflowEngine orchestrates pagination updates for a document.
 *
 * @example
 * ```typescript
 * const engine = new ReflowEngine(config)
 * engine.setView(editorView)
 *
 * // Listen for page changes
 * engine.onPagesChanged((model) => {
 *   console.log(`Now have ${model.pageCount} pages`)
 * })
 *
 * // Trigger reflow when content changes
 * engine.requestReflow()
 * ```
 */
export class ReflowEngine {
  private config: PaginationConfig
  private dimensions: PageDimensions
  private measurer: Measurer
  private computer: PageComputer
  private view: EditorView | null = null
  private currentModel: PaginationModel | null = null
  private currentVisualModel: VisualPaginationModel | null = null
  private pageGapPx: number = 40
  private marginPx: number = 72

  // Debounce state
  private pendingReflow: ReturnType<typeof setTimeout> | null = null
  private pendingRAF: number | null = null
  private pendingIdleCallback: number | null = null
  private pendingChanges: ReflowChange[] = []

  // Event handlers
  private reflowStartHandlers: ReflowStartHandler[] = []
  private reflowEndHandlers: ReflowEndHandler[] = []
  private pagesChangedHandlers: PagesChangedHandler[] = []

  // State
  private isReflowing = false
  private lastReflowTime = 0
  private reflowCount = 0
  private totalReflowTime = 0

  constructor(config: Partial<PaginationConfig> = {}) {
    this.config = { ...DEFAULT_PAGINATION_CONFIG, ...config }
    this.dimensions = createPageDimensions(this.config)
    this.measurer = new Measurer(this.config, this.dimensions)
    this.computer = new PageComputer(this.config, this.dimensions)
    this.computer.setMeasurer(this.measurer)
  }

  /**
   * Set the editor view for DOM-based measurement
   */
  setView(view: EditorView): void {
    this.view = view
    this.measurer.setView(view)
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<PaginationConfig>): void {
    this.config = { ...this.config, ...config }
    this.dimensions = createPageDimensions(this.config)
    this.measurer.setDimensions(this.dimensions)
    this.computer.setDimensions(this.dimensions)

    // Full reflow needed when config changes
    this.measurer.clearCache()
    this.requestReflow()
  }

  /**
   * Get current pagination model
   */
  getModel(): PaginationModel | null {
    return this.currentModel
  }

  /**
   * Get current configuration
   */
  getConfig(): PaginationConfig {
    return { ...this.config }
  }

  /**
   * Get current dimensions
   */
  getDimensions(): PageDimensions {
    return { ...this.dimensions }
  }

  /**
   * Request a reflow (debounced)
   *
   * Call this when document content changes. The actual reflow
   * will be debounced to avoid excessive computation.
   */
  requestReflow(change?: ReflowChange): void {
    if (change) {
      this.pendingChanges.push(change)
    }

    // Clear existing pending reflow
    if (this.pendingReflow !== null) {
      clearTimeout(this.pendingReflow)
    }

    // Schedule debounced reflow
    this.pendingReflow = setTimeout(() => {
      this.performReflow()
    }, this.config.reflowDebounceMs)
  }

  /**
   * Request immediate reflow (no debounce)
   */
  requestImmediateReflow(): void {
    this.cancelPendingReflows()
    this.performReflow()
  }

  /**
   * Request reflow using requestAnimationFrame
   * Better for synchronizing with browser paint cycle
   */
  requestRAFReflow(): void {
    this.cancelPendingReflows()

    this.pendingRAF = requestAnimationFrame(() => {
      this.pendingRAF = null
      this.performReflow()
    })
  }

  /**
   * Request idle reflow using requestIdleCallback
   * Best for non-urgent reflows that shouldn't block interaction
   */
  requestIdleReflow(timeout = 1000): void {
    this.cancelPendingReflows()

    if (typeof requestIdleCallback === 'function') {
      this.pendingIdleCallback = requestIdleCallback(
        () => {
          this.pendingIdleCallback = null
          this.performReflow()
        },
        { timeout }
      )
    } else {
      // Fallback to setTimeout for environments without requestIdleCallback
      this.pendingReflow = setTimeout(() => {
        this.pendingReflow = null
        this.performReflow()
      }, 0)
    }
  }

  /**
   * Cancel all pending reflows
   */
  private cancelPendingReflows(): void {
    if (this.pendingReflow !== null) {
      clearTimeout(this.pendingReflow)
      this.pendingReflow = null
    }
    if (this.pendingRAF !== null) {
      cancelAnimationFrame(this.pendingRAF)
      this.pendingRAF = null
    }
    if (this.pendingIdleCallback !== null && typeof cancelIdleCallback === 'function') {
      cancelIdleCallback(this.pendingIdleCallback)
      this.pendingIdleCallback = null
    }
  }

  /**
   * Handle a ProseMirror transaction
   *
   * Call this from your editor's update handler to track changes.
   */
  handleTransaction(tr: Transaction): void {
    if (!tr.docChanged) {
      return
    }

    // Collect changes from the transaction
    tr.steps.forEach((_step, i) => {
      const map = tr.mapping.maps[i]
      map.forEach((from: number, to: number, newFrom: number, newTo: number) => {
        this.pendingChanges.push({
          type: newTo > newFrom ? 'insert' : from !== to ? 'delete' : 'update',
          pos: Math.min(from, newFrom),
          range: { from: Math.min(from, newFrom), to: Math.max(to, newTo) },
        })
      })
    })

    // Invalidate measurement cache for affected range
    if (this.pendingChanges.length > 0) {
      const minPos = Math.min(...this.pendingChanges.map((c) => c.range.from))
      const maxPos = Math.max(...this.pendingChanges.map((c) => c.range.to))
      this.measurer.invalidateRange(minPos, maxPos)
    }

    this.requestReflow()
  }

  /**
   * Perform the actual reflow computation
   */
  private performReflow(): void {
    if (!this.view) {
      console.warn('ReflowEngine: No view set, skipping reflow')
      return
    }

    if (this.isReflowing) {
      // Already reflowing, schedule another
      this.requestReflow()
      return
    }

    this.isReflowing = true
    const startTime = performance.now()

    // Emit reflow start
    this.reflowStartHandlers.forEach((h) => h())

    try {
      const doc = this.view.state.doc
      let newModel: PaginationModel

      // Check if we can do incremental reflow
      if (this.currentModel && this.pendingChanges.length > 0) {
        // Find earliest change position
        const earliestChange = Math.min(
          ...this.pendingChanges.map((c) => c.range.from)
        )

        // Incremental reflow from change point
        newModel = this.computer.computeFrom(
          doc,
          this.currentModel,
          earliestChange
        )
      } else {
        // Full reflow
        newModel = this.computer.compute(doc)
      }

      // Also compute visual model (single source of truth for spacers)
      const newVisualModel = this.computer.computeVisual(
        doc,
        this.pageGapPx,
        this.marginPx
      )

      // Clear pending changes
      this.pendingChanges = []

      // Check if pages actually changed
      const pagesChanged = !this.currentModel ||
        this.currentModel.pageCount !== newModel.pageCount ||
        !this.pagesEqual(this.currentModel, newModel)

      this.currentModel = newModel
      this.currentVisualModel = newVisualModel
      this.lastReflowTime = Date.now()

      // Track performance
      const duration = performance.now() - startTime
      this.totalReflowTime += duration
      this.reflowCount++

      // Emit events
      if (pagesChanged) {
        this.pagesChangedHandlers.forEach((h) => h(newModel))
      }
      this.reflowEndHandlers.forEach((h) => h(newModel))
    } catch (error) {
      console.error('ReflowEngine: Error during reflow', error)
    } finally {
      this.isReflowing = false
    }
  }

  /**
   * Compare two pagination models for equality
   */
  private pagesEqual(a: PaginationModel, b: PaginationModel): boolean {
    if (a.pageCount !== b.pageCount) return false

    for (let i = 0; i < a.pages.length; i++) {
      const pageA = a.pages[i]
      const pageB = b.pages[i]

      if (
        pageA.startPos !== pageB.startPos ||
        pageA.endPos !== pageB.endPos ||
        pageA.forcedBreak !== pageB.forcedBreak
      ) {
        return false
      }
    }

    return true
  }

  /**
   * Force a full reflow, clearing all caches
   */
  forceFullReflow(): void {
    this.measurer.clearCache()
    this.currentModel = null
    this.pendingChanges = []
    this.requestImmediateReflow()
  }

  /**
   * Get the page number for a document position
   */
  getPageForPosition(pos: number): number {
    if (!this.currentModel) return 1
    return this.computer.getPageForPosition(this.currentModel, pos)
  }

  /**
   * Get the document position range for a page
   */
  getPositionRangeForPage(pageNumber: number): PosRange | null {
    if (!this.currentModel) return null
    const page = this.computer.getPage(this.currentModel, pageNumber)
    if (!page) return null
    return { from: page.startPos, to: page.endPos }
  }

  /**
   * Register handler for reflow start
   */
  onReflowStart(handler: ReflowStartHandler): () => void {
    this.reflowStartHandlers.push(handler)
    return () => {
      const index = this.reflowStartHandlers.indexOf(handler)
      if (index > -1) this.reflowStartHandlers.splice(index, 1)
    }
  }

  /**
   * Register handler for reflow end
   */
  onReflowEnd(handler: ReflowEndHandler): () => void {
    this.reflowEndHandlers.push(handler)
    return () => {
      const index = this.reflowEndHandlers.indexOf(handler)
      if (index > -1) this.reflowEndHandlers.splice(index, 1)
    }
  }

  /**
   * Register handler for pages changed
   */
  onPagesChanged(handler: PagesChangedHandler): () => void {
    this.pagesChangedHandlers.push(handler)
    return () => {
      const index = this.pagesChangedHandlers.indexOf(handler)
      if (index > -1) this.pagesChangedHandlers.splice(index, 1)
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cancelPendingReflows()
    this.reflowStartHandlers = []
    this.reflowEndHandlers = []
    this.pagesChangedHandlers = []
    this.view = null
    this.currentModel = null
    this.measurer.clearCache()
  }

  /**
   * Get statistics for debugging and performance monitoring
   */
  getStats(): {
    lastReflowTime: number
    pageCount: number
    cacheStats: { size: number; hitRate: number; hits: number; misses: number }
    isReflowing: boolean
    pendingChanges: number
    reflowCount: number
    totalReflowTime: number
    averageReflowTime: number
  } {
    return {
      lastReflowTime: this.lastReflowTime,
      pageCount: this.currentModel?.pageCount ?? 0,
      cacheStats: this.measurer.getCacheStats(),
      isReflowing: this.isReflowing,
      pendingChanges: this.pendingChanges.length,
      reflowCount: this.reflowCount,
      totalReflowTime: this.totalReflowTime,
      averageReflowTime: this.reflowCount > 0 ? this.totalReflowTime / this.reflowCount : 0,
    }
  }

  /**
   * Reset performance statistics
   */
  resetStats(): void {
    this.reflowCount = 0
    this.totalReflowTime = 0
    this.measurer.resetStats()
  }

  /**
   * Get spacers from the visual pagination model
   *
   * Returns an array of spacers that should be injected into the document
   * to push content past page boundaries. Each spacer represents the gap
   * between the end of one page's content and the start of the next.
   *
   * This is the single source of truth for page layout - spacers are computed
   * during reflow and cached in the visual model.
   *
   * @param _pageGapPx - Deprecated: gap is now computed during reflow
   * @param _marginPx - Deprecated: margin is now computed during reflow
   */
  getSpacers(_pageGapPx?: number, _marginPx?: number): PageSpacer[] {
    return this.currentVisualModel?.spacers ?? []
  }

  /**
   * Get the visual pagination model
   *
   * This provides the single source of truth for page layout including:
   * - Visual positions (in pixels) for each block
   * - Which page each block belongs to
   * - Spacers to inject at page breaks with exact heights and positions
   */
  getVisualModel(): VisualPaginationModel | null {
    return this.currentVisualModel
  }

  /**
   * Configure the visual layout parameters
   *
   * @param pageGapPx - Gap between pages in pixels
   * @param marginPx - Top/bottom margin of each page in pixels
   */
  setVisualLayoutParams(pageGapPx: number, marginPx: number): void {
    this.pageGapPx = pageGapPx
    this.marginPx = marginPx
    // Trigger reflow to update spacers with new parameters
    this.requestReflow()
  }
}
