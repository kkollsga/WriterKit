/**
 * PDF Exporter using pdf-lib for searchable text output.
 * @packageDocumentation
 */

import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { createPageDimensions } from '../pagination'
import type { PageDimensions, PageBoundary } from '../pagination'
import type {
  PDFExportOptions,
  ExportResult,
  ExportStats,
  RenderContext,
  FontConfig,
  DocumentMetadata,
} from './types'
import { DEFAULT_FONTS, parsePageRange, replaceTemplateVariables } from './types'

/**
 * Text run with formatting.
 */
interface TextRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  code?: boolean
  link?: string
  color?: string
  fontSize?: number
}

/**
 * A line of text ready to be rendered.
 */
interface TextLine {
  runs: TextRun[]
  width: number
  height: number
  align?: 'left' | 'center' | 'right' | 'justify'
}

/**
 * PDF Exporter that generates searchable PDFs with real text.
 * Uses pdf-lib instead of html2canvas for proper text extraction.
 */
export class PDFExporter {
  private fonts: Map<string, PDFFont> = new Map()
  private defaultFonts: Record<string, FontConfig>

  constructor(fontConfig?: Partial<Record<string, FontConfig>>) {
    this.defaultFonts = { ...DEFAULT_FONTS }
    if (fontConfig) {
      for (const [key, value] of Object.entries(fontConfig)) {
        if (value) {
          this.defaultFonts[key] = value
        }
      }
    }
  }

  /**
   * Export a ProseMirror document to PDF.
   */
  async export(
    document: ProseMirrorNode,
    options: PDFExportOptions = {}
  ): Promise<ExportResult> {
    const startTime = performance.now()

    // Create PDF document
    const pdfDoc = await PDFDocument.create()

    // Embed standard fonts
    await this.embedFonts(pdfDoc)

    // Get page dimensions
    const pageDimensions = options.pageDimensions || createPageDimensions({
      pageSize: 'a4',
      orientation: 'portrait',
      margins: { top: 72, right: 72, bottom: 72, left: 72 },
      headerHeight: 0,
      footerHeight: 0,
    })

    // Set metadata
    this.setMetadata(pdfDoc, options.metadata)

    // Determine pages to export
    const paginationModel = options.paginationModel
    const totalPages = paginationModel?.pageCount || this.estimatePageCount(document, pageDimensions)
    const pagesToExport = parsePageRange(options.pageRange, totalPages)

    // Render each page
    let imageCount = 0
    for (const pageNum of pagesToExport) {
      const page = pdfDoc.addPage([pageDimensions.width, pageDimensions.height])

      // Get page boundary if pagination model exists
      const boundary = paginationModel?.pages[pageNum - 1]

      // Create render context
      const context: RenderContext = {
        pageNumber: pageNum,
        totalPages,
        y: pageDimensions.height - pageDimensions.margins.top,
        contentWidth: pageDimensions.contentWidth,
        remainingHeight: pageDimensions.contentHeight,
        pageDimensions,
        metadata: options.metadata || {},
        fonts: this.defaultFonts,
      }

      // Render header
      if (options.includeHeadersFooters && options.headerTemplate) {
        this.renderHeaderFooter(page, options.headerTemplate, context, 'header')
      }

      // Render document content for this page
      if (boundary) {
        await this.renderPageContent(page, document, boundary, context)
      } else {
        // No pagination model - render all content on first page
        if (pageNum === 1) {
          await this.renderDocument(page, document, context)
        }
      }

      // Render footer
      if (options.includeHeadersFooters && options.footerTemplate) {
        this.renderHeaderFooter(page, options.footerTemplate, context, 'footer')
      }
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save()
    const exportTimeMs = performance.now() - startTime

    const stats: ExportStats = {
      pageCount: pagesToExport.length,
      fileSize: pdfBytes.length,
      exportTimeMs,
      imageCount,
      fontCount: this.fonts.size,
    }

    return {
      data: new Uint8Array(pdfBytes),
      mimeType: this.getMimeType(),
      filename: `${options.metadata?.title || 'document'}.pdf`,
      extension: 'pdf',
      stats,
    }
  }

  /**
   * Embed standard fonts into the PDF.
   */
  private async embedFonts(pdfDoc: PDFDocument): Promise<void> {
    // Embed standard fonts
    this.fonts.set('Helvetica', await pdfDoc.embedFont(StandardFonts.Helvetica))
    this.fonts.set('Helvetica-Bold', await pdfDoc.embedFont(StandardFonts.HelveticaBold))
    this.fonts.set('Helvetica-Oblique', await pdfDoc.embedFont(StandardFonts.HelveticaOblique))
    this.fonts.set('Helvetica-BoldOblique', await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique))
    this.fonts.set('Courier', await pdfDoc.embedFont(StandardFonts.Courier))
    this.fonts.set('Courier-Bold', await pdfDoc.embedFont(StandardFonts.CourierBold))
    this.fonts.set('Times-Roman', await pdfDoc.embedFont(StandardFonts.TimesRoman))
    this.fonts.set('Times-Bold', await pdfDoc.embedFont(StandardFonts.TimesRomanBold))
    this.fonts.set('Times-Italic', await pdfDoc.embedFont(StandardFonts.TimesRomanItalic))
  }

  /**
   * Set PDF metadata.
   */
  private setMetadata(pdfDoc: PDFDocument, metadata?: DocumentMetadata): void {
    if (!metadata) return

    if (metadata.title) pdfDoc.setTitle(metadata.title)
    if (metadata.author) pdfDoc.setAuthor(metadata.author)
    if (metadata.subject) pdfDoc.setSubject(metadata.subject)
    if (metadata.keywords) pdfDoc.setKeywords(metadata.keywords)
    if (metadata.creator) pdfDoc.setCreator(metadata.creator)
    if (metadata.producer) pdfDoc.setProducer(metadata.producer)
    if (metadata.creationDate) pdfDoc.setCreationDate(metadata.creationDate)
    if (metadata.modificationDate) pdfDoc.setModificationDate(metadata.modificationDate)
  }

  /**
   * Render header or footer.
   */
  private renderHeaderFooter(
    page: PDFPage,
    template: string,
    context: RenderContext,
    position: 'header' | 'footer'
  ): void {
    const text = replaceTemplateVariables(template, {
      pageNumber: context.pageNumber,
      totalPages: context.totalPages,
      title: context.metadata.title,
    })

    const font = this.fonts.get('Helvetica')!
    const fontSize = 10
    const textWidth = font.widthOfTextAtSize(text, fontSize)

    const x = context.pageDimensions.margins.left +
      (context.contentWidth - textWidth) / 2

    const y = position === 'header'
      ? context.pageDimensions.height - context.pageDimensions.margins.top / 2
      : context.pageDimensions.margins.bottom / 2

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })
  }

  /**
   * Render content for a specific page boundary.
   */
  private async renderPageContent(
    page: PDFPage,
    document: ProseMirrorNode,
    boundary: PageBoundary,
    context: RenderContext
  ): Promise<void> {
    // Walk through nodes that fall within this page's position range
    let currentY = context.y

    document.descendants((node, pos) => {
      // Check if node is within this page's boundary
      if (pos >= boundary.startPos && pos < boundary.endPos) {
        const result = this.renderNode(page, node, context.pageDimensions.margins.left, currentY, context)
        currentY = result.y
        return false // Don't descend into children, we handle them
      }
      return true // Continue traversing
    })
  }

  /**
   * Render entire document (when no pagination model).
   */
  private async renderDocument(
    page: PDFPage,
    document: ProseMirrorNode,
    context: RenderContext
  ): Promise<void> {
    let currentY = context.y

    document.forEach((node) => {
      const result = this.renderNode(page, node, context.pageDimensions.margins.left, currentY, context)
      currentY = result.y
    })
  }

  /**
   * Render a single node and return the new Y position.
   */
  private renderNode(
    page: PDFPage,
    node: ProseMirrorNode,
    x: number,
    y: number,
    context: RenderContext
  ): { y: number } {
    const nodeType = node.type.name

    switch (nodeType) {
      case 'paragraph':
        return this.renderParagraph(page, node, x, y, context)
      case 'heading':
        return this.renderHeading(page, node, x, y, context)
      case 'bulletList':
      case 'orderedList':
        return this.renderList(page, node, x, y, context, nodeType === 'orderedList')
      case 'codeBlock':
        return this.renderCodeBlock(page, node, x, y, context)
      case 'blockquote':
        return this.renderBlockquote(page, node, x, y, context)
      case 'horizontalRule':
        return this.renderHorizontalRule(page, x, y, context)
      case 'hardBreak':
        return { y: y - this.defaultFonts.body.size * this.defaultFonts.body.lineHeight }
      default:
        // For unknown nodes, try to render text content
        if (node.isText) {
          return this.renderTextNode(page, node, x, y, context)
        }
        return { y }
    }
  }

  /**
   * Render a paragraph.
   */
  private renderParagraph(
    page: PDFPage,
    node: ProseMirrorNode,
    x: number,
    y: number,
    context: RenderContext
  ): { y: number } {
    const fontConfig = this.defaultFonts.body
    const runs = this.extractTextRuns(node)
    const lines = this.wrapText(runs, context.contentWidth, fontConfig)

    let currentY = y
    for (const line of lines) {
      this.renderTextLine(page, line, x, currentY, fontConfig)
      currentY -= fontConfig.size * fontConfig.lineHeight
    }

    // Add paragraph spacing
    currentY -= fontConfig.size * 0.5

    return { y: currentY }
  }

  /**
   * Render a heading.
   */
  private renderHeading(
    page: PDFPage,
    node: ProseMirrorNode,
    x: number,
    y: number,
    context: RenderContext
  ): { y: number } {
    const level = node.attrs.level || 1
    const fontKey = `heading${level}` as keyof typeof DEFAULT_FONTS
    const fontConfig = this.defaultFonts[fontKey] || this.defaultFonts.heading1

    // Add space before heading
    let currentY = y - fontConfig.size * 0.5

    const runs = this.extractTextRuns(node)
    const lines = this.wrapText(runs, context.contentWidth, fontConfig)

    for (const line of lines) {
      this.renderTextLine(page, line, x, currentY, fontConfig)
      currentY -= fontConfig.size * fontConfig.lineHeight
    }

    // Add space after heading
    currentY -= fontConfig.size * 0.3

    return { y: currentY }
  }

  /**
   * Render a list (bullet or ordered).
   */
  private renderList(
    page: PDFPage,
    node: ProseMirrorNode,
    x: number,
    y: number,
    context: RenderContext,
    ordered: boolean
  ): { y: number } {
    const fontConfig = this.defaultFonts.body
    const indent = 20
    let currentY = y
    let itemNumber = 1

    node.forEach((listItem) => {
      // Draw bullet or number
      const marker = ordered ? `${itemNumber}.` : '•'
      const font = this.fonts.get(fontConfig.family) || this.fonts.get('Helvetica')!

      page.drawText(marker, {
        x,
        y: currentY,
        size: fontConfig.size,
        font,
        color: rgb(0, 0, 0),
      })

      // Render list item content
      listItem.forEach((child) => {
        const result = this.renderNode(page, child, x + indent, currentY, {
          ...context,
          contentWidth: context.contentWidth - indent,
        })
        currentY = result.y
      })

      itemNumber++
    })

    return { y: currentY }
  }

  /**
   * Render a code block.
   */
  private renderCodeBlock(
    page: PDFPage,
    node: ProseMirrorNode,
    x: number,
    y: number,
    context: RenderContext
  ): { y: number } {
    const fontConfig = this.defaultFonts.code
    const font = this.fonts.get('Courier') || this.fonts.get('Helvetica')!
    const padding = 8
    const bgColor = rgb(0.95, 0.95, 0.95)

    const text = node.textContent
    const lines = text.split('\n')
    const lineHeight = fontConfig.size * fontConfig.lineHeight
    const blockHeight = lines.length * lineHeight + padding * 2

    // Draw background
    page.drawRectangle({
      x,
      y: y - blockHeight + padding,
      width: context.contentWidth,
      height: blockHeight,
      color: bgColor,
    })

    // Draw text
    let currentY = y - padding
    for (const line of lines) {
      page.drawText(line, {
        x: x + padding,
        y: currentY,
        size: fontConfig.size,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })
      currentY -= lineHeight
    }

    return { y: y - blockHeight - fontConfig.size * 0.5 }
  }

  /**
   * Render a blockquote.
   */
  private renderBlockquote(
    page: PDFPage,
    node: ProseMirrorNode,
    x: number,
    y: number,
    context: RenderContext
  ): { y: number } {
    const indent = 20
    const borderX = x + 4
    let startY = y
    let currentY = y

    // Render children with indent
    node.forEach((child) => {
      const result = this.renderNode(page, child, x + indent, currentY, {
        ...context,
        contentWidth: context.contentWidth - indent,
      })
      currentY = result.y
    })

    // Draw left border
    page.drawLine({
      start: { x: borderX, y: startY },
      end: { x: borderX, y: currentY + 10 },
      thickness: 3,
      color: rgb(0.8, 0.8, 0.8),
    })

    return { y: currentY }
  }

  /**
   * Render a horizontal rule.
   */
  private renderHorizontalRule(
    page: PDFPage,
    x: number,
    y: number,
    context: RenderContext
  ): { y: number } {
    const ruleY = y - 10

    page.drawLine({
      start: { x, y: ruleY },
      end: { x: x + context.contentWidth, y: ruleY },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    })

    return { y: ruleY - 10 }
  }

  /**
   * Render a text node directly.
   */
  private renderTextNode(
    page: PDFPage,
    node: ProseMirrorNode,
    x: number,
    y: number,
    _context: RenderContext
  ): { y: number } {
    const fontConfig = this.defaultFonts.body
    const font = this.fonts.get(fontConfig.family) || this.fonts.get('Helvetica')!
    const text = node.text || ''

    page.drawText(text, {
      x,
      y,
      size: fontConfig.size,
      font,
      color: rgb(0, 0, 0),
    })

    return { y: y - fontConfig.size * fontConfig.lineHeight }
  }

  /**
   * Extract text runs with formatting from a node.
   */
  private extractTextRuns(node: ProseMirrorNode): TextRun[] {
    const runs: TextRun[] = []

    node.forEach((child) => {
      if (child.isText) {
        const run: TextRun = { text: child.text || '' }

        // Check for marks
        child.marks.forEach((mark) => {
          switch (mark.type.name) {
            case 'bold':
            case 'strong':
              run.bold = true
              break
            case 'italic':
            case 'em':
              run.italic = true
              break
            case 'underline':
              run.underline = true
              break
            case 'strike':
            case 'strikethrough':
              run.strikethrough = true
              break
            case 'code':
              run.code = true
              break
            case 'link':
              run.link = mark.attrs.href
              break
          }
        })

        runs.push(run)
      }
    })

    return runs
  }

  /**
   * Wrap text runs into lines that fit within the available width.
   */
  private wrapText(runs: TextRun[], maxWidth: number, fontConfig: FontConfig): TextLine[] {
    const lines: TextLine[] = []
    let currentLine: TextRun[] = []
    let currentWidth = 0

    const font = this.fonts.get(fontConfig.family) || this.fonts.get('Helvetica')!

    for (const run of runs) {
      const words = run.text.split(/(\s+)/)

      for (const word of words) {
        const wordWidth = font.widthOfTextAtSize(word, fontConfig.size)

        if (currentWidth + wordWidth > maxWidth && currentLine.length > 0) {
          // Start new line
          lines.push({
            runs: currentLine,
            width: currentWidth,
            height: fontConfig.size * fontConfig.lineHeight,
          })
          currentLine = []
          currentWidth = 0
        }

        if (word.trim()) {
          currentLine.push({ ...run, text: word })
          currentWidth += wordWidth
        } else if (currentLine.length > 0) {
          // Add space
          currentLine.push({ ...run, text: word })
          currentWidth += wordWidth
        }
      }
    }

    // Add remaining line
    if (currentLine.length > 0) {
      lines.push({
        runs: currentLine,
        width: currentWidth,
        height: fontConfig.size * fontConfig.lineHeight,
      })
    }

    return lines
  }

  /**
   * Render a line of text with formatting.
   */
  private renderTextLine(
    page: PDFPage,
    line: TextLine,
    x: number,
    y: number,
    fontConfig: FontConfig
  ): void {
    let currentX = x

    for (const run of line.runs) {
      const fontName = this.getFontName(fontConfig.family, run.bold, run.italic)
      const font = this.fonts.get(fontName) || this.fonts.get('Helvetica')!
      const fontSize = run.fontSize || fontConfig.size

      // Parse color
      const color = run.color ? this.parseColor(run.color) : rgb(0, 0, 0)

      // Draw text
      page.drawText(run.text, {
        x: currentX,
        y,
        size: fontSize,
        font,
        color,
      })

      const textWidth = font.widthOfTextAtSize(run.text, fontSize)

      // Draw underline
      if (run.underline) {
        page.drawLine({
          start: { x: currentX, y: y - 2 },
          end: { x: currentX + textWidth, y: y - 2 },
          thickness: 0.5,
          color,
        })
      }

      // Draw strikethrough
      if (run.strikethrough) {
        page.drawLine({
          start: { x: currentX, y: y + fontSize / 3 },
          end: { x: currentX + textWidth, y: y + fontSize / 3 },
          thickness: 0.5,
          color,
        })
      }

      currentX += textWidth
    }
  }

  /**
   * Get font name based on style.
   */
  private getFontName(family: string, bold?: boolean, italic?: boolean): string {
    if (family.startsWith('Courier')) {
      return bold ? 'Courier-Bold' : 'Courier'
    }
    if (family.startsWith('Times')) {
      if (bold && italic) return 'Times-BoldItalic'
      if (bold) return 'Times-Bold'
      if (italic) return 'Times-Italic'
      return 'Times-Roman'
    }
    // Default to Helvetica
    if (bold && italic) return 'Helvetica-BoldOblique'
    if (bold) return 'Helvetica-Bold'
    if (italic) return 'Helvetica-Oblique'
    return 'Helvetica'
  }

  /**
   * Parse a color string to RGB values.
   */
  private parseColor(color: string): ReturnType<typeof rgb> {
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1)
      const r = parseInt(hex.slice(0, 2), 16) / 255
      const g = parseInt(hex.slice(2, 4), 16) / 255
      const b = parseInt(hex.slice(4, 6), 16) / 255
      return rgb(r, g, b)
    }
    // Default to black
    return rgb(0, 0, 0)
  }

  /**
   * Estimate page count when no pagination model is provided.
   */
  private estimatePageCount(document: ProseMirrorNode, dimensions: PageDimensions): number {
    // Rough estimate: 40 lines per page
    const linesPerPage = Math.floor(dimensions.contentHeight / (12 * 1.5))
    let totalLines = 0

    document.descendants((node) => {
      if (node.isBlock) {
        const textContent = node.textContent
        const estimatedLines = Math.ceil(textContent.length / 80) || 1
        totalLines += estimatedLines
      }
      return true
    })

    return Math.max(1, Math.ceil(totalLines / linesPerPage))
  }

  getMimeType(): string {
    return 'application/pdf'
  }

  getExtension(): string {
    return 'pdf'
  }

  getFormatName(): 'pdf' {
    return 'pdf'
  }
}
