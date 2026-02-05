import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ExportPipeline, createExportPipeline } from './ExportPipeline'
import type { Exporter, ExportResult, ExportOptions, ExportFormat } from './types'
import type { Node as ProseMirrorNode } from 'prosemirror-model'

// Mock exporter for testing
function createMockExporter(format: ExportFormat): Exporter<ExportOptions> {
  return {
    export: vi.fn().mockResolvedValue({
      data: new Uint8Array([1, 2, 3]),
      mimeType: `application/${format}`,
      filename: `document.${format}`,
      extension: format,
      stats: {
        pageCount: 1,
        fileSize: 3,
        exportTimeMs: 10,
      },
    } as ExportResult),
    getMimeType: () => `application/${format}`,
    getExtension: () => format,
    getFormatName: () => format,
  }
}

// Mock ProseMirror document
const mockDocument = {
  type: { name: 'doc' },
  content: { size: 0 },
} as unknown as ProseMirrorNode

describe('ExportPipeline', () => {
  let pipeline: ExportPipeline

  beforeEach(() => {
    pipeline = new ExportPipeline()
  })

  describe('constructor', () => {
    it('registers built-in exporters by default', () => {
      expect(pipeline.isSupported('pdf')).toBe(true)
      expect(pipeline.isSupported('docx')).toBe(true)
      expect(pipeline.isSupported('odt')).toBe(true)
    })

    it('accepts default options in config', () => {
      const pipeline = new ExportPipeline({
        defaultOptions: {
          metadata: { title: 'Default Title' },
        },
      })
      expect(pipeline.isSupported('pdf')).toBe(true)
    })
  })

  describe('registerExporter', () => {
    it('registers a custom exporter', () => {
      const mockExporter = createMockExporter('markdown')
      pipeline.registerExporter('markdown', mockExporter)
      expect(pipeline.isSupported('markdown')).toBe(true)
    })

    it('can override built-in exporters', () => {
      const customPdfExporter = createMockExporter('pdf')
      pipeline.registerExporter('pdf', customPdfExporter)
      expect(pipeline.getExporter('pdf')).toBe(customPdfExporter)
    })
  })

  describe('unregisterExporter', () => {
    it('removes a registered exporter', () => {
      expect(pipeline.isSupported('pdf')).toBe(true)
      const result = pipeline.unregisterExporter('pdf')
      expect(result).toBe(true)
      expect(pipeline.isSupported('pdf')).toBe(false)
    })

    it('returns false for non-existent exporter', () => {
      const result = pipeline.unregisterExporter('markdown')
      expect(result).toBe(false)
    })
  })

  describe('getSupportedFormats', () => {
    it('returns list of registered formats', () => {
      const formats = pipeline.getSupportedFormats()
      expect(formats).toContain('pdf')
      expect(formats).toContain('docx')
      expect(formats).toContain('odt')
    })
  })

  describe('getExporter', () => {
    it('returns exporter for supported format', () => {
      const exporter = pipeline.getExporter('pdf')
      expect(exporter).toBeDefined()
    })

    it('returns undefined for unsupported format', () => {
      const exporter = pipeline.getExporter('markdown')
      expect(exporter).toBeUndefined()
    })
  })

  describe('getMimeType', () => {
    it('returns MIME type for supported format', () => {
      const mimeType = pipeline.getMimeType('pdf')
      expect(mimeType).toBe('application/pdf')
    })

    it('returns undefined for unsupported format', () => {
      const mimeType = pipeline.getMimeType('markdown')
      expect(mimeType).toBeUndefined()
    })
  })

  describe('getExtension', () => {
    it('returns extension for supported format', () => {
      const extension = pipeline.getExtension('pdf')
      expect(extension).toBe('pdf')
    })

    it('returns undefined for unsupported format', () => {
      const extension = pipeline.getExtension('markdown')
      expect(extension).toBeUndefined()
    })
  })

  describe('export', () => {
    it('throws error for unsupported format', async () => {
      await expect(pipeline.export(mockDocument, 'markdown')).rejects.toThrow(
        /Unsupported export format: markdown/
      )
    })

    it('calls exporter with merged options', async () => {
      const mockExporter = createMockExporter('pdf')
      pipeline.registerExporter('pdf', mockExporter)

      const options = { metadata: { title: 'Test' } }
      await pipeline.export(mockDocument, 'pdf', options)

      expect(mockExporter.export).toHaveBeenCalledWith(mockDocument, options)
    })

    it('merges default options with provided options', async () => {
      const pipelineWithDefaults = new ExportPipeline({
        defaultOptions: {
          metadata: { title: 'Default Title' },
          includeHeadersFooters: true,
        },
      })

      const mockExporter = createMockExporter('pdf')
      pipelineWithDefaults.registerExporter('pdf', mockExporter)

      await pipelineWithDefaults.export(mockDocument, 'pdf', {
        metadata: { author: 'Test Author' },
      })

      expect(mockExporter.export).toHaveBeenCalledWith(mockDocument, {
        metadata: { author: 'Test Author' },
        includeHeadersFooters: true,
      })
    })
  })

  describe('exportPDF', () => {
    it('exports to PDF format', async () => {
      const mockExporter = createMockExporter('pdf')
      pipeline.registerExporter('pdf', mockExporter)

      const result = await pipeline.exportPDF(mockDocument)
      expect(result).toBeDefined()
      expect(mockExporter.export).toHaveBeenCalled()
    })
  })

  describe('exportDOCX', () => {
    it('exports to DOCX format', async () => {
      const mockExporter = createMockExporter('docx')
      pipeline.registerExporter('docx', mockExporter)

      const result = await pipeline.exportDOCX(mockDocument)
      expect(result).toBeDefined()
      expect(mockExporter.export).toHaveBeenCalled()
    })
  })

  describe('exportODT', () => {
    it('exports to ODT format', async () => {
      const mockExporter = createMockExporter('odt')
      pipeline.registerExporter('odt', mockExporter)

      const result = await pipeline.exportODT(mockDocument)
      expect(result).toBeDefined()
      expect(mockExporter.export).toHaveBeenCalled()
    })
  })

  describe('exportMultiple', () => {
    it('exports to multiple formats in parallel', async () => {
      const pdfExporter = createMockExporter('pdf')
      const docxExporter = createMockExporter('docx')
      pipeline.registerExporter('pdf', pdfExporter)
      pipeline.registerExporter('docx', docxExporter)

      const results = await pipeline.exportMultiple(mockDocument, ['pdf', 'docx'])

      expect(results.size).toBe(2)
      expect(results.get('pdf')).toBeDefined()
      expect(results.get('docx')).toBeDefined()
      expect(pdfExporter.export).toHaveBeenCalled()
      expect(docxExporter.export).toHaveBeenCalled()
    })

    it('passes options to all exporters', async () => {
      const pdfExporter = createMockExporter('pdf')
      const docxExporter = createMockExporter('docx')
      pipeline.registerExporter('pdf', pdfExporter)
      pipeline.registerExporter('docx', docxExporter)

      const options = { metadata: { title: 'Batch Export' } }
      await pipeline.exportMultiple(mockDocument, ['pdf', 'docx'], options)

      expect(pdfExporter.export).toHaveBeenCalledWith(mockDocument, options)
      expect(docxExporter.export).toHaveBeenCalledWith(mockDocument, options)
    })
  })
})

describe('createExportPipeline', () => {
  it('creates a new ExportPipeline instance', () => {
    const pipeline = createExportPipeline()
    expect(pipeline).toBeInstanceOf(ExportPipeline)
  })

  it('accepts configuration', () => {
    const pipeline = createExportPipeline({
      defaultOptions: {
        metadata: { title: 'Factory Created' },
      },
    })
    expect(pipeline).toBeInstanceOf(ExportPipeline)
  })
})
