/**
 * DOCX Exporter using the docx library.
 * @packageDocumentation
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageBreak,
  ExternalHyperlink,
  Header,
  Footer,
  PageNumber,
} from 'docx'
import type { Node as ProseMirrorNode, Mark } from 'prosemirror-model'
import { createPageDimensions } from '../pagination'
import type {
  DOCXExportOptions,
  ExportResult,
  ExportStats,
  DocumentMetadata,
} from './types'

/**
 * Converts points to twips (twentieths of a point).
 * DOCX uses twips for measurements.
 */
function pointsToTwips(points: number): number {
  return Math.round(points * 20)
}

/**
 * DOCX Exporter that generates Microsoft Word documents.
 */
export class DOCXExporter {
  /**
   * Export a ProseMirror document to DOCX format.
   */
  async export(
    document: ProseMirrorNode,
    options: DOCXExportOptions = {}
  ): Promise<ExportResult> {
    const startTime = performance.now()

    // Get page dimensions
    const pageDimensions = options.pageDimensions || createPageDimensions({
      pageSize: 'a4',
      orientation: 'portrait',
      margins: { top: 72, right: 72, bottom: 72, left: 72 },
      headerHeight: 0,
      footerHeight: 0,
    })

    // Build document sections
    const children = this.convertDocument(document, options)

    // Create DOCX document
    const doc = new Document({
      creator: options.metadata?.author || 'WriterKit',
      title: options.metadata?.title,
      description: options.metadata?.subject,
      keywords: options.metadata?.keywords?.join(', '),
      sections: [
        {
          properties: {
            page: {
              size: {
                width: pointsToTwips(pageDimensions.width),
                height: pointsToTwips(pageDimensions.height),
              },
              margin: {
                top: pointsToTwips(pageDimensions.margins.top),
                right: pointsToTwips(pageDimensions.margins.right),
                bottom: pointsToTwips(pageDimensions.margins.bottom),
                left: pointsToTwips(pageDimensions.margins.left),
              },
            },
          },
          headers: options.includeHeadersFooters && options.headerTemplate
            ? { default: this.createHeader(options.headerTemplate, options.metadata) }
            : undefined,
          footers: options.includeHeadersFooters && options.footerTemplate
            ? { default: this.createFooter(options.footerTemplate, options.metadata) }
            : undefined,
          children,
        },
      ],
    })

    // Generate DOCX buffer
    const buffer = await Packer.toBuffer(doc)
    const exportTimeMs = performance.now() - startTime

    const stats: ExportStats = {
      pageCount: options.paginationModel?.pageCount || 1,
      fileSize: buffer.byteLength,
      exportTimeMs,
    }

    return {
      data: new Uint8Array(buffer),
      mimeType: this.getMimeType(),
      filename: `${options.metadata?.title || 'document'}.docx`,
      extension: 'docx',
      stats,
    }
  }

  /**
   * Convert ProseMirror document to DOCX elements.
   */
  private convertDocument(
    document: ProseMirrorNode,
    options: DOCXExportOptions
  ): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = []

    document.forEach((node) => {
      const converted = this.convertNode(node, options)
      if (Array.isArray(converted)) {
        elements.push(...converted)
      } else if (converted) {
        elements.push(converted)
      }
    })

    return elements
  }

  /**
   * Convert a single ProseMirror node to DOCX element(s).
   */
  private convertNode(
    node: ProseMirrorNode,
    options: DOCXExportOptions
  ): Paragraph | Table | (Paragraph | Table)[] | null {
    const nodeType = node.type.name

    switch (nodeType) {
      case 'paragraph':
        return this.convertParagraph(node, options)
      case 'heading':
        return this.convertHeading(node, options)
      case 'bulletList':
        return this.convertBulletList(node, options)
      case 'orderedList':
        return this.convertOrderedList(node, options)
      case 'listItem':
        return this.convertListItem(node, options)
      case 'codeBlock':
        return this.convertCodeBlock(node, options)
      case 'blockquote':
        return this.convertBlockquote(node, options)
      case 'horizontalRule':
        return this.convertHorizontalRule()
      case 'hardBreak':
        return null // Handled within text runs
      case 'pageBreak':
        return this.convertPageBreak()
      case 'table':
        return this.convertTable(node, options)
      default:
        // Try to convert as paragraph if it has text content
        if (node.textContent) {
          return new Paragraph({
            children: this.convertInlineContent(node),
          })
        }
        return null
    }
  }

  /**
   * Convert paragraph node.
   */
  private convertParagraph(
    node: ProseMirrorNode,
    _options: DOCXExportOptions
  ): Paragraph {
    const alignment = this.getAlignment(node.attrs.textAlign)

    return new Paragraph({
      alignment,
      children: this.convertInlineContent(node),
    })
  }

  /**
   * Convert heading node.
   */
  private convertHeading(
    node: ProseMirrorNode,
    _options: DOCXExportOptions
  ): Paragraph {
    const level = node.attrs.level || 1
    const headingLevel = this.getHeadingLevel(level)
    const alignment = this.getAlignment(node.attrs.textAlign)

    return new Paragraph({
      heading: headingLevel,
      alignment,
      children: this.convertInlineContent(node),
    })
  }

  /**
   * Convert bullet list.
   */
  private convertBulletList(
    node: ProseMirrorNode,
    options: DOCXExportOptions
  ): Paragraph[] {
    const paragraphs: Paragraph[] = []

    node.forEach((listItem) => {
      listItem.forEach((child) => {
        if (child.type.name === 'paragraph') {
          paragraphs.push(
            new Paragraph({
              bullet: { level: 0 },
              children: this.convertInlineContent(child),
            })
          )
        } else {
          const converted = this.convertNode(child, options)
          if (converted) {
            if (Array.isArray(converted)) {
              paragraphs.push(...converted.filter((c): c is Paragraph => c instanceof Paragraph))
            } else if (converted instanceof Paragraph) {
              paragraphs.push(converted)
            }
          }
        }
      })
    })

    return paragraphs
  }

  /**
   * Convert ordered list.
   */
  private convertOrderedList(
    node: ProseMirrorNode,
    options: DOCXExportOptions
  ): Paragraph[] {
    const paragraphs: Paragraph[] = []

    node.forEach((listItem, _offset, _index) => {
      listItem.forEach((child) => {
        if (child.type.name === 'paragraph') {
          paragraphs.push(
            new Paragraph({
              numbering: { reference: 'default-numbering', level: 0 },
              children: this.convertInlineContent(child),
            })
          )
        } else {
          const converted = this.convertNode(child, options)
          if (converted) {
            if (Array.isArray(converted)) {
              paragraphs.push(...converted.filter((c): c is Paragraph => c instanceof Paragraph))
            } else if (converted instanceof Paragraph) {
              paragraphs.push(converted)
            }
          }
        }
      })
    })

    return paragraphs
  }

  /**
   * Convert list item (when processing nested lists).
   */
  private convertListItem(
    node: ProseMirrorNode,
    options: DOCXExportOptions
  ): Paragraph[] {
    const paragraphs: Paragraph[] = []

    node.forEach((child) => {
      const converted = this.convertNode(child, options)
      if (converted) {
        if (Array.isArray(converted)) {
          paragraphs.push(...converted.filter((c): c is Paragraph => c instanceof Paragraph))
        } else if (converted instanceof Paragraph) {
          paragraphs.push(converted)
        }
      }
    })

    return paragraphs
  }

  /**
   * Convert code block.
   */
  private convertCodeBlock(
    node: ProseMirrorNode,
    _options: DOCXExportOptions
  ): Paragraph {
    const text = node.textContent

    return new Paragraph({
      shading: {
        type: 'solid' as const,
        color: 'F5F5F5',
      },
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
      children: [
        new TextRun({
          text,
          font: 'Courier New',
          size: 20, // 10pt in half-points
        }),
      ],
    })
  }

  /**
   * Convert blockquote.
   */
  private convertBlockquote(
    node: ProseMirrorNode,
    options: DOCXExportOptions
  ): Paragraph[] {
    const paragraphs: Paragraph[] = []

    node.forEach((child) => {
      if (child.type.name === 'paragraph') {
        paragraphs.push(
          new Paragraph({
            indent: { left: pointsToTwips(36) },
            border: {
              left: { style: BorderStyle.SINGLE, size: 24, color: 'CCCCCC' },
            },
            children: this.convertInlineContent(child),
          })
        )
      } else {
        const converted = this.convertNode(child, options)
        if (converted) {
          if (Array.isArray(converted)) {
            paragraphs.push(...converted.filter((c): c is Paragraph => c instanceof Paragraph))
          } else if (converted instanceof Paragraph) {
            paragraphs.push(converted)
          }
        }
      }
    })

    return paragraphs
  }

  /**
   * Convert horizontal rule.
   */
  private convertHorizontalRule(): Paragraph {
    return new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
      },
      children: [],
    })
  }

  /**
   * Convert page break.
   */
  private convertPageBreak(): Paragraph {
    return new Paragraph({
      children: [new PageBreak()],
    })
  }

  /**
   * Convert table.
   */
  private convertTable(
    node: ProseMirrorNode,
    options: DOCXExportOptions
  ): Table {
    const rows: TableRow[] = []

    node.forEach((rowNode) => {
      if (rowNode.type.name === 'tableRow') {
        const cells: TableCell[] = []

        rowNode.forEach((cellNode) => {
          if (cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') {
            const paragraphs: Paragraph[] = []

            cellNode.forEach((child) => {
              const converted = this.convertNode(child, options)
              if (converted) {
                if (Array.isArray(converted)) {
                  paragraphs.push(...converted.filter((c): c is Paragraph => c instanceof Paragraph))
                } else if (converted instanceof Paragraph) {
                  paragraphs.push(converted)
                }
              }
            })

            cells.push(
              new TableCell({
                children: paragraphs.length > 0 ? paragraphs : [new Paragraph({})],
                shading: cellNode.type.name === 'tableHeader'
                  ? { type: 'solid' as const, color: 'F0F0F0' }
                  : undefined,
              })
            )
          }
        })

        rows.push(new TableRow({ children: cells }))
      }
    })

    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  }

  /**
   * Convert inline content (text with marks) to TextRuns.
   */
  private convertInlineContent(node: ProseMirrorNode): (TextRun | ExternalHyperlink)[] {
    const runs: (TextRun | ExternalHyperlink)[] = []

    node.forEach((child) => {
      if (child.isText) {
        const text = child.text || ''
        const formatting = this.getFormatting(child.marks)

        // Check for link mark
        const linkMark = child.marks.find((m) => m.type.name === 'link')
        if (linkMark) {
          runs.push(
            new ExternalHyperlink({
              link: linkMark.attrs.href,
              children: [
                new TextRun({
                  text,
                  ...formatting,
                  color: '0066CC',
                  underline: { type: 'single' as const },
                }),
              ],
            })
          )
        } else {
          runs.push(new TextRun({ text, ...formatting }))
        }
      } else if (child.type.name === 'hardBreak') {
        runs.push(new TextRun({ text: '', break: 1 }))
      }
    })

    return runs
  }

  /**
   * Get text formatting from marks.
   */
  private getFormatting(marks: readonly Mark[]): {
    bold?: boolean
    italics?: boolean
    underline?: { type: 'single' }
    strike?: boolean
    font?: string
    highlight?: 'yellow' | 'green' | 'cyan' | 'magenta' | 'blue' | 'red' | 'darkBlue' | 'darkCyan' | 'darkGreen' | 'darkMagenta' | 'darkRed' | 'darkYellow' | 'lightGray' | 'darkGray' | 'black'
    color?: string
  } {
    type HighlightColor = 'yellow' | 'green' | 'cyan' | 'magenta' | 'blue' | 'red' | 'darkBlue' | 'darkCyan' | 'darkGreen' | 'darkMagenta' | 'darkRed' | 'darkYellow' | 'lightGray' | 'darkGray' | 'black'
    const validHighlights: HighlightColor[] = ['yellow', 'green', 'cyan', 'magenta', 'blue', 'red', 'darkBlue', 'darkCyan', 'darkGreen', 'darkMagenta', 'darkRed', 'darkYellow', 'lightGray', 'darkGray', 'black']
    const formatting: ReturnType<typeof this.getFormatting> = {}

    for (const mark of marks) {
      switch (mark.type.name) {
        case 'bold':
        case 'strong':
          formatting.bold = true
          break
        case 'italic':
        case 'em':
          formatting.italics = true
          break
        case 'underline':
          formatting.underline = { type: 'single' }
          break
        case 'strike':
        case 'strikethrough':
          formatting.strike = true
          break
        case 'code':
          formatting.font = 'Courier New'
          break
        case 'highlight': {
          const color = mark.attrs.color || 'yellow'
          if (validHighlights.includes(color as HighlightColor)) {
            formatting.highlight = color as HighlightColor
          } else {
            formatting.highlight = 'yellow'
          }
          break
        }
        case 'textStyle':
          if (mark.attrs.color) {
            formatting.color = mark.attrs.color.replace('#', '')
          }
          break
      }
    }

    return formatting
  }

  /**
   * Get alignment type from string.
   */
  private getAlignment(align?: string): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
    switch (align) {
      case 'left':
        return AlignmentType.LEFT
      case 'center':
        return AlignmentType.CENTER
      case 'right':
        return AlignmentType.RIGHT
      case 'justify':
        return AlignmentType.JUSTIFIED
      default:
        return undefined
    }
  }

  /**
   * Get heading level from number.
   */
  private getHeadingLevel(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
    switch (level) {
      case 1:
        return HeadingLevel.HEADING_1
      case 2:
        return HeadingLevel.HEADING_2
      case 3:
        return HeadingLevel.HEADING_3
      case 4:
        return HeadingLevel.HEADING_4
      case 5:
        return HeadingLevel.HEADING_5
      case 6:
        return HeadingLevel.HEADING_6
      default:
        return HeadingLevel.HEADING_1
    }
  }

  /**
   * Create header.
   */
  private createHeader(template: string, metadata?: DocumentMetadata): Header {
    // Note: DOCX headers don't support dynamic page numbers in the same way
    // We use special fields for page numbers
    const text = template
      .replace(/\{\{title\}\}/g, metadata?.title || '')
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())

    const children: TextRun[] = []

    // Simple approach: if template contains page number placeholders, add page number field
    if (template.includes('{{pageNumber}}') || template.includes('{{totalPages}}')) {
      const parts = text.split(/\{\{pageNumber\}\}|\{\{totalPages\}\}/g)
      parts.forEach((part, i) => {
        if (part) {
          children.push(new TextRun({ text: part }))
        }
        if (i < parts.length - 1) {
          children.push(new TextRun({ children: [PageNumber.CURRENT] }))
        }
      })
    } else {
      children.push(new TextRun({ text }))
    }

    return new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children,
        }),
      ],
    })
  }

  /**
   * Create footer.
   */
  private createFooter(template: string, metadata?: DocumentMetadata): Footer {
    const text = template
      .replace(/\{\{title\}\}/g, metadata?.title || '')
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())

    const children: TextRun[] = []

    if (template.includes('{{pageNumber}}')) {
      const parts = text.split('{{pageNumber}}')
      parts.forEach((part, i) => {
        if (part) {
          children.push(new TextRun({ text: part.replace('{{totalPages}}', '') }))
        }
        if (i < parts.length - 1) {
          children.push(new TextRun({ children: [PageNumber.CURRENT] }))
          if (template.includes('{{totalPages}}')) {
            children.push(new TextRun({ text: ' of ' }))
            children.push(new TextRun({ children: [PageNumber.TOTAL_PAGES] }))
          }
        }
      })
    } else {
      children.push(new TextRun({ text }))
    }

    return new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children,
        }),
      ],
    })
  }

  getMimeType(): string {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }

  getExtension(): string {
    return 'docx'
  }

  getFormatName(): 'docx' {
    return 'docx'
  }
}
