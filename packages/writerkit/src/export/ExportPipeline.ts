/**
 * Export Pipeline - Orchestrates document exports across formats.
 * @packageDocumentation
 */

import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type {
  ExportFormat,
  ExportOptions,
  ExportResult,
  Exporter,
  PDFExportOptions,
  DOCXExportOptions,
  ODTExportOptions,
} from './types'
import { PDFExporter } from './PDFExporter'
import { DOCXExporter } from './DOCXExporter'
import { ODTExporter } from './ODTExporter'

/**
 * Union type for format-specific options.
 */
export type FormatOptions = PDFExportOptions | DOCXExportOptions | ODTExportOptions

/**
 * Export Pipeline configuration.
 */
export interface ExportPipelineConfig {
  /** Default options for all exports */
  defaultOptions?: ExportOptions
}

/**
 * Export Pipeline that manages and coordinates document exports.
 *
 * @example
 * ```typescript
 * const pipeline = new ExportPipeline()
 *
 * // Export to PDF
 * const result = await pipeline.export(document, 'pdf', {
 *   metadata: { title: 'My Document' },
 *   paginationModel: model,
 * })
 *
 * // Download the file
 * const blob = new Blob([result.data], { type: result.mimeType })
 * saveAs(blob, result.filename)
 * ```
 */
export class ExportPipeline {
  private exporters: Map<ExportFormat, Exporter<ExportOptions>> = new Map()
  private defaultOptions: ExportOptions

  constructor(config: ExportPipelineConfig = {}) {
    this.defaultOptions = config.defaultOptions || {}

    // Register built-in exporters
    this.registerExporter('pdf', new PDFExporter())
    this.registerExporter('docx', new DOCXExporter())
    this.registerExporter('odt', new ODTExporter())
  }

  /**
   * Register a custom exporter for a format.
   */
  registerExporter(format: ExportFormat, exporter: Exporter<ExportOptions>): void {
    this.exporters.set(format, exporter)
  }

  /**
   * Unregister an exporter.
   */
  unregisterExporter(format: ExportFormat): boolean {
    return this.exporters.delete(format)
  }

  /**
   * Get a registered exporter.
   */
  getExporter(format: ExportFormat): Exporter<ExportOptions> | undefined {
    return this.exporters.get(format)
  }

  /**
   * Check if a format is supported.
   */
  isSupported(format: ExportFormat): boolean {
    return this.exporters.has(format)
  }

  /**
   * Get list of supported formats.
   */
  getSupportedFormats(): ExportFormat[] {
    return Array.from(this.exporters.keys())
  }

  /**
   * Export a document to the specified format.
   */
  async export(
    document: ProseMirrorNode,
    format: ExportFormat,
    options?: FormatOptions
  ): Promise<ExportResult> {
    const exporter = this.exporters.get(format)
    if (!exporter) {
      throw new Error(`Unsupported export format: ${format}. Supported formats: ${this.getSupportedFormats().join(', ')}`)
    }

    // Merge options
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
    }

    return exporter.export(document, mergedOptions)
  }

  /**
   * Export a document to PDF.
   */
  async exportPDF(
    document: ProseMirrorNode,
    options?: PDFExportOptions
  ): Promise<ExportResult> {
    return this.export(document, 'pdf', options)
  }

  /**
   * Export a document to DOCX.
   */
  async exportDOCX(
    document: ProseMirrorNode,
    options?: DOCXExportOptions
  ): Promise<ExportResult> {
    return this.export(document, 'docx', options)
  }

  /**
   * Export a document to ODT.
   */
  async exportODT(
    document: ProseMirrorNode,
    options?: ODTExportOptions
  ): Promise<ExportResult> {
    return this.export(document, 'odt', options)
  }

  /**
   * Export to multiple formats at once.
   * Returns a map of format to export result.
   */
  async exportMultiple(
    document: ProseMirrorNode,
    formats: ExportFormat[],
    options?: ExportOptions
  ): Promise<Map<ExportFormat, ExportResult>> {
    const results = new Map<ExportFormat, ExportResult>()

    // Export in parallel for better performance
    const promises = formats.map(async (format) => {
      const result = await this.export(document, format, options)
      return { format, result }
    })

    const completed = await Promise.all(promises)
    for (const { format, result } of completed) {
      results.set(format, result)
    }

    return results
  }

  /**
   * Get MIME type for a format.
   */
  getMimeType(format: ExportFormat): string | undefined {
    return this.exporters.get(format)?.getMimeType()
  }

  /**
   * Get file extension for a format.
   */
  getExtension(format: ExportFormat): string | undefined {
    return this.exporters.get(format)?.getExtension()
  }
}

/**
 * Create a default export pipeline instance.
 */
export function createExportPipeline(config?: ExportPipelineConfig): ExportPipeline {
  return new ExportPipeline(config)
}
