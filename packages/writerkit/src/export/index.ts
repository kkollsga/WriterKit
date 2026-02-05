/**
 * @writerkit/export
 *
 * Document export pipeline and format converters for WriterKit.
 * Supports exporting documents to PDF, DOCX, ODT, and other formats
 * while preserving formatting, pagination, and document structure.
 *
 * @example
 * ```typescript
 * import { ExportPipeline, createExportPipeline } from '../export'
 *
 * // Create pipeline
 * const pipeline = createExportPipeline()
 *
 * // Export to PDF
 * const result = await pipeline.exportPDF(document, {
 *   metadata: { title: 'My Document', author: 'John Doe' },
 *   paginationModel: pageModel,
 *   includeHeadersFooters: true,
 *   footerTemplate: 'Page {{pageNumber}} of {{totalPages}}',
 * })
 *
 * // Download
 * const blob = new Blob([result.data], { type: result.mimeType })
 * saveAs(blob, result.filename)
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
  ExportFormat,
  TextAlign,
  DocumentMetadata,
  FontConfig,
  ExportOptions,
  PDFExportOptions,
  DOCXExportOptions,
  ODTExportOptions,
  ExportResult,
  ExportStats,
  RenderContext,
  NodeRenderer,
  Exporter,
} from './types'

export {
  DEFAULT_FONTS,
  parsePageRange,
  replaceTemplateVariables,
} from './types'

// Exporters
export { PDFExporter } from './PDFExporter'
export { DOCXExporter } from './DOCXExporter'
export { ODTExporter } from './ODTExporter'

// Pipeline
export {
  ExportPipeline,
  createExportPipeline,
} from './ExportPipeline'
export type {
  FormatOptions,
  ExportPipelineConfig,
} from './ExportPipeline'
