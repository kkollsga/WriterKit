/**
 * Export types and interfaces for WriterKit.
 * @packageDocumentation
 */

import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { PaginationModel, PageDimensions } from '../pagination'

/**
 * Supported export formats.
 */
export type ExportFormat = 'pdf' | 'docx' | 'odt' | 'markdown' | 'html'

/**
 * Text alignment options.
 */
export type TextAlign = 'left' | 'center' | 'right' | 'justify'

/**
 * Document metadata for export.
 */
export interface DocumentMetadata {
  title?: string
  author?: string
  subject?: string
  keywords?: string[]
  creator?: string
  producer?: string
  creationDate?: Date
  modificationDate?: Date
}

/**
 * Font configuration for export.
 */
export interface FontConfig {
  /** Font family name */
  family: string
  /** Font size in points */
  size: number
  /** Line height multiplier */
  lineHeight: number
  /** Font color (hex or rgb) */
  color?: string
}

/**
 * Default font configurations.
 */
export const DEFAULT_FONTS: Record<string, FontConfig> = {
  body: { family: 'Helvetica', size: 12, lineHeight: 1.5 },
  heading1: { family: 'Helvetica-Bold', size: 24, lineHeight: 1.3 },
  heading2: { family: 'Helvetica-Bold', size: 20, lineHeight: 1.3 },
  heading3: { family: 'Helvetica-Bold', size: 16, lineHeight: 1.3 },
  heading4: { family: 'Helvetica-Bold', size: 14, lineHeight: 1.3 },
  heading5: { family: 'Helvetica-Bold', size: 12, lineHeight: 1.3 },
  heading6: { family: 'Helvetica-Bold', size: 11, lineHeight: 1.3 },
  code: { family: 'Courier', size: 10, lineHeight: 1.4 },
}

/**
 * Base export options shared across all formats.
 */
export interface ExportOptions {
  /** Include headers and footers */
  includeHeadersFooters?: boolean
  /** Page range to export (e.g., "1-5", "1,3,5", or undefined for all) */
  pageRange?: string
  /** Document metadata */
  metadata?: DocumentMetadata
  /** Page dimensions and margins */
  pageDimensions?: PageDimensions
  /** Pagination model with page boundaries */
  paginationModel?: PaginationModel
  /** Header template (supports {{pageNumber}}, {{totalPages}}, {{title}}) */
  headerTemplate?: string
  /** Footer template */
  footerTemplate?: string
}

/**
 * PDF-specific export options.
 */
export interface PDFExportOptions extends ExportOptions {
  /** Embed fonts in PDF */
  embedFonts?: boolean
  /** PDF/A compliance level */
  pdfA?: '1b' | '2b' | '3b'
  /** Compression level */
  compression?: 'none' | 'fast' | 'best'
  /** Image DPI for embedded images */
  imageDpi?: number
  /** Font configuration overrides */
  fonts?: Partial<Record<string, FontConfig>>
}

/**
 * DOCX-specific export options.
 */
export interface DOCXExportOptions extends ExportOptions {
  /** Use strict OOXML compliance */
  strictOOXML?: boolean
  /** Include table of contents */
  includeTableOfContents?: boolean
}

/**
 * ODT-specific export options.
 */
export interface ODTExportOptions extends ExportOptions {
  /** ODF version to target */
  odfVersion?: '1.2' | '1.3'
}

/**
 * Result of an export operation.
 */
export interface ExportResult {
  /** Exported data */
  data: Blob | Uint8Array
  /** MIME type */
  mimeType: string
  /** Suggested filename */
  filename: string
  /** File extension */
  extension: string
  /** Export statistics */
  stats: ExportStats
}

/**
 * Statistics about the export operation.
 */
export interface ExportStats {
  /** Number of pages exported */
  pageCount: number
  /** File size in bytes */
  fileSize: number
  /** Export duration in milliseconds */
  exportTimeMs: number
  /** Number of images embedded */
  imageCount?: number
  /** Number of fonts embedded */
  fontCount?: number
}

/**
 * Context passed to node renderers during export.
 */
export interface RenderContext {
  /** Current page number (1-indexed) */
  pageNumber: number
  /** Total number of pages */
  totalPages: number
  /** Current Y position on page (from top) */
  y: number
  /** Available width for content */
  contentWidth: number
  /** Available height remaining on page */
  remainingHeight: number
  /** Page dimensions */
  pageDimensions: PageDimensions
  /** Document metadata */
  metadata: DocumentMetadata
  /** Font configuration */
  fonts: Record<string, FontConfig>
}

/**
 * Abstract interface for format-specific node renderers.
 */
export interface NodeRenderer<TOutput> {
  /** Render a ProseMirror node to the target format */
  render(node: ProseMirrorNode, context: RenderContext): TOutput | Promise<TOutput>
  /** Check if this renderer handles the given node type */
  canRender(nodeType: string): boolean
}

/**
 * Interface for exporters.
 */
export interface Exporter<TOptions extends ExportOptions = ExportOptions> {
  /** Export a document */
  export(document: ProseMirrorNode, options?: TOptions): Promise<ExportResult>
  /** Get the MIME type for this format */
  getMimeType(): string
  /** Get the file extension */
  getExtension(): string
  /** Get the format name */
  getFormatName(): ExportFormat
}

/**
 * Parse a page range string into an array of page numbers.
 * @param range - Page range string (e.g., "1-5", "1,3,5-7")
 * @param totalPages - Total number of pages in document
 * @returns Array of 1-indexed page numbers
 */
export function parsePageRange(range: string | undefined, totalPages: number): number[] {
  if (!range) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = new Set<number>()
  const parts = range.split(',')

  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(Number)
      for (let i = start; i <= Math.min(end, totalPages); i++) {
        if (i >= 1) pages.add(i)
      }
    } else {
      const page = Number(trimmed)
      if (page >= 1 && page <= totalPages) {
        pages.add(page)
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b)
}

/**
 * Replace template variables in header/footer strings.
 */
export function replaceTemplateVariables(
  template: string,
  context: { pageNumber: number; totalPages: number; title?: string; date?: Date }
): string {
  return template
    .replace(/\{\{pageNumber\}\}/g, String(context.pageNumber))
    .replace(/\{\{totalPages\}\}/g, String(context.totalPages))
    .replace(/\{\{title\}\}/g, context.title || '')
    .replace(/\{\{date\}\}/g, context.date?.toLocaleDateString() || new Date().toLocaleDateString())
}
