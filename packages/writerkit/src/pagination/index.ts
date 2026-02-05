/**
 * @writerkit/pagination
 *
 * Page computation engine for WriterKit.
 *
 * This package provides the pagination engine that computes page boundaries
 * from document content. It includes:
 *
 * - **Measurer** - Measures block heights with caching
 * - **PageComputer** - Computes page boundaries from measurements
 * - **ReflowEngine** - Orchestrates pagination with debounced updates
 * - **PageView** - Visual page rendering components
 *
 * @example
 * ```typescript
 * import {
 *   ReflowEngine,
 *   createPageDimensions,
 *   DEFAULT_PAGINATION_CONFIG
 * } from '../pagination'
 *
 * // Create the reflow engine
 * const engine = new ReflowEngine({
 *   ...DEFAULT_PAGINATION_CONFIG,
 *   pageSize: 'a4',
 *   margins: { top: 72, right: 72, bottom: 72, left: 72 }
 * })
 *
 * // Set the editor view for DOM measurement
 * engine.setView(editorView)
 *
 * // Listen for page changes
 * engine.onPagesChanged((model) => {
 *   console.log(`Document has ${model.pageCount} pages`)
 * })
 *
 * // Request reflow when content changes
 * engine.requestReflow()
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
  PageSize,
  PageOrientation,
  PageDimensions,
  PageBoundary,
  NodePosition,
  PaginationModel,
  BlockMeasurement,
  PaginationConfig,
  PaginationEvents,
  SplitResult,
  PosRange,
  ReflowChange,
} from './types'

export {
  PAGE_SIZES,
  DEFAULT_PAGINATION_CONFIG,
  createPageDimensions,
  configFromMetadata,
} from './types'

// Measurer
export { Measurer } from './Measurer'

// PageComputer
export { PageComputer } from './PageComputer'

// ReflowEngine
export { ReflowEngine } from './ReflowEngine'

// PageView
export { PageView, PageViewManager } from './PageView'
export type { PageViewOptions } from './PageView'
