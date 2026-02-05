/**
 * Pagination types for WriterKit
 *
 * These types define the core data structures for the pagination engine,
 * including page boundaries, dimensions, and measurement results.
 */

import type { Margins, DocumentMetadata } from '../core'

/**
 * Standard page sizes in points (1 point = 1/72 inch)
 */
export const PAGE_SIZES = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
  legal: { width: 612, height: 1008 },
  a3: { width: 841.89, height: 1190.55 },
  a5: { width: 419.53, height: 595.28 },
} as const

export type PageSize = keyof typeof PAGE_SIZES

/**
 * Page orientation
 */
export type PageOrientation = 'portrait' | 'landscape'

/**
 * Physical page dimensions in points
 */
export interface PageDimensions {
  /** Total page width in points */
  width: number
  /** Total page height in points */
  height: number
  /** Content area width (width - left margin - right margin) */
  contentWidth: number
  /** Content area height (height - top margin - bottom margin - header - footer) */
  contentHeight: number
  /** Page margins */
  margins: Margins
  /** Header height (0 if no header) */
  headerHeight: number
  /** Footer height (0 if no footer) */
  footerHeight: number
}

/**
 * A boundary marking where one page ends and another begins
 */
export interface PageBoundary {
  /** 1-indexed page number */
  pageNumber: number
  /** ProseMirror document position where this page starts */
  startPos: number
  /** ProseMirror document position where this page ends */
  endPos: number
  /** Actual content height used on this page (in points) */
  contentHeight: number
  /** Whether this page starts due to a forced/manual page break */
  forcedBreak: boolean
  /** Nodes contained on this page (by position) */
  nodePositions: NodePosition[]
}

/**
 * Position and measurement data for a node
 */
export interface NodePosition {
  /** ProseMirror position of this node */
  pos: number
  /** Height of this node in points */
  height: number
  /** Node type name */
  type: string
  /** Whether this is a page break node */
  isPageBreak: boolean
}

/**
 * The complete page model for a document
 */
export interface PaginationModel {
  /** All page boundaries */
  pages: PageBoundary[]
  /** Page dimensions used for calculation */
  dimensions: PageDimensions
  /** Total document height if laid out as a single column */
  totalContentHeight: number
  /** Total number of pages */
  pageCount: number
}

/**
 * Represents a single line within a block
 */
export interface LineMeasurement {
  /** Index of this line within the block (0-based) */
  index: number
  /** Height of this line in pixels */
  heightPx: number
  /** Height of this line in points */
  height: number
  /** Top position relative to block start (pixels) */
  topPx: number
  /** Bottom position relative to block start (pixels) */
  bottomPx: number
  /** Whether this is the first line of the block */
  isFirst: boolean
  /** Whether this is the last line of the block */
  isLast: boolean
}

/**
 * Result of measuring a block/node
 */
export interface BlockMeasurement {
  /** ProseMirror position */
  pos: number
  /** Node type */
  type: string
  /** Measured height in points */
  height: number
  /** Whether this block can be split across pages */
  splittable: boolean
  /** Minimum height if split (e.g., header row for tables) */
  minHeight?: number
  /** For splittable blocks, individual item heights */
  itemHeights?: number[]
  /** Line-level measurements for text blocks */
  lines?: LineMeasurement[]
  /** Number of lines in this block */
  lineCount?: number
  /** Whether this block can be split at line boundaries */
  splittableAtLine?: boolean
}

/**
 * Configuration for the pagination engine
 */
export interface PaginationConfig {
  /** Page size preset */
  pageSize: PageSize
  /** Page orientation */
  orientation: PageOrientation
  /** Page margins in points */
  margins: Margins
  /** Height reserved for header (in points) */
  headerHeight: number
  /** Height reserved for footer (in points) */
  footerHeight: number
  /** Debounce time for reflow in milliseconds */
  reflowDebounceMs: number
  /** Minimum lines to keep together at top of page (widows) */
  widowLines: number
  /** Minimum lines to keep together at bottom of page (orphans) */
  orphanLines: number
  /** Default line height for estimations (in points) */
  defaultLineHeight: number
  /** Pixels per point conversion factor (for screen rendering) */
  pixelsPerPoint: number
}

/**
 * Default pagination configuration
 */
export const DEFAULT_PAGINATION_CONFIG: PaginationConfig = {
  pageSize: 'a4',
  orientation: 'portrait',
  margins: {
    top: 72, // 1 inch
    right: 72,
    bottom: 72,
    left: 72,
  },
  headerHeight: 0,
  footerHeight: 0,
  reflowDebounceMs: 100,
  widowLines: 2,
  orphanLines: 2,
  defaultLineHeight: 14,
  pixelsPerPoint: 1.333, // 96dpi / 72ppi
}

/**
 * Events emitted by the pagination system
 */
export interface PaginationEvents {
  /** Fired when page boundaries change */
  pagesChanged: (model: PaginationModel) => void
  /** Fired when reflow starts */
  reflowStart: () => void
  /** Fired when reflow completes */
  reflowEnd: (model: PaginationModel) => void
  /** Fired when a page is scrolled into view */
  pageVisible: (pageNumber: number) => void
}

/**
 * Options for creating PageDimensions from metadata
 */
export function createPageDimensions(
  config: Pick<PaginationConfig, 'pageSize' | 'orientation' | 'margins' | 'headerHeight' | 'footerHeight'>
): PageDimensions {
  const baseSize = PAGE_SIZES[config.pageSize]

  // Swap dimensions for landscape
  const width = config.orientation === 'landscape' ? baseSize.height : baseSize.width
  const height = config.orientation === 'landscape' ? baseSize.width : baseSize.height

  const contentWidth = width - config.margins.left - config.margins.right
  const contentHeight =
    height -
    config.margins.top -
    config.margins.bottom -
    config.headerHeight -
    config.footerHeight

  return {
    width,
    height,
    contentWidth,
    contentHeight,
    margins: config.margins,
    headerHeight: config.headerHeight,
    footerHeight: config.footerHeight,
  }
}

/**
 * Create pagination config from document metadata
 */
export function configFromMetadata(metadata: DocumentMetadata): Partial<PaginationConfig> {
  return {
    pageSize: metadata.pageSize,
    orientation: metadata.orientation,
    margins: metadata.margins,
    headerHeight: metadata.header ? 36 : 0, // Default header height
    footerHeight: metadata.footer ? 36 : 0, // Default footer height
  }
}

/**
 * Result when splitting a node across pages
 */
export interface SplitResult {
  /** Content that fits on current page */
  kept: {
    height: number
    itemCount: number
  }
  /** Content that overflows to next page */
  overflow: {
    height: number
    itemCount: number
  }
}

/**
 * Range of positions in the document
 */
export interface PosRange {
  from: number
  to: number
}

/**
 * Change notification for incremental reflow
 */
export interface ReflowChange {
  /** Type of change */
  type: 'insert' | 'delete' | 'update'
  /** Position where change occurred */
  pos: number
  /** Affected range */
  range: PosRange
}

/**
 * A spacer to be injected at a page boundary to push content to next page
 */
export interface PageSpacer {
  /** Position in document where spacer should be inserted (before this position) */
  pos: number
  /** Height of the spacer in pixels */
  height: number
  /** Page number this spacer ends */
  pageNumber: number
  /** Visual offset from top of content where this spacer should appear (in pixels) */
  visualOffset: number
  /** If splitting within a block, the line index where split occurs */
  splitAtLine?: number
  /** If splitting within a block, offset from top of block to split point (pixels) */
  splitOffset?: number
}

/**
 * Extended block measurement with visual position tracking
 */
export interface VisualBlockMeasurement extends BlockMeasurement {
  /** Visual offset from top of content (cumulative, in pixels) */
  visualTop: number
  /** Visual bottom position (visualTop + height in pixels) */
  visualBottom: number
  /** Which page this block belongs to (1-indexed) */
  pageNumber: number
  /** If this block is split, which part this is (1 = first part, 2 = continuation) */
  splitPart?: number
  /** If split, the line range this part contains [startLine, endLine] */
  lineRange?: [number, number]
  /** If split, the height of this part in pixels */
  partHeightPx?: number
}

/**
 * Extended pagination model with visual information
 */
export interface VisualPaginationModel extends PaginationModel {
  /** Block measurements with visual positions */
  visualBlocks: VisualBlockMeasurement[]
  /** Spacers to inject at page breaks */
  spacers: PageSpacer[]
  /** Map of document position to page number */
  positionToPage: Map<number, number>
}
