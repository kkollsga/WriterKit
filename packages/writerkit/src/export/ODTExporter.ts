/**
 * ODT Exporter - Creates OpenDocument Text files.
 * ODT is an XML-based format stored as a ZIP archive.
 * @packageDocumentation
 */

import type { Node as ProseMirrorNode, Mark } from 'prosemirror-model'
import { createPageDimensions } from '../pagination'
import type { PageDimensions } from '../pagination'
import type {
  ODTExportOptions,
  ExportResult,
  ExportStats,
  DocumentMetadata,
} from './types'

/**
 * Escape XML special characters.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Convert points to centimeters (ODT uses cm).
 */
function pointsToCm(points: number): string {
  return `${(points / 72 * 2.54).toFixed(3)}cm`
}

/**
 * ODT Exporter that generates OpenDocument Text files.
 *
 * Note: This is a basic implementation. For production use, consider
 * using a library like simple-odf or odfkit for full ODF compliance.
 */
export class ODTExporter {
  /**
   * Export a ProseMirror document to ODT format.
   */
  async export(
    document: ProseMirrorNode,
    options: ODTExportOptions = {}
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

    // Generate XML content
    const contentXml = this.generateContentXml(document, pageDimensions, options)
    const stylesXml = this.generateStylesXml(pageDimensions)
    const metaXml = this.generateMetaXml(options.metadata)
    const manifestXml = this.generateManifestXml()
    const mimetypeContent = 'application/vnd.oasis.opendocument.text'

    // Create ZIP file using browser/node APIs
    const zipData = await this.createZip({
      'mimetype': mimetypeContent,
      'META-INF/manifest.xml': manifestXml,
      'content.xml': contentXml,
      'styles.xml': stylesXml,
      'meta.xml': metaXml,
    })

    const exportTimeMs = performance.now() - startTime

    const stats: ExportStats = {
      pageCount: options.paginationModel?.pageCount || 1,
      fileSize: zipData.byteLength,
      exportTimeMs,
    }

    return {
      data: new Uint8Array(zipData),
      mimeType: this.getMimeType(),
      filename: `${options.metadata?.title || 'document'}.odt`,
      extension: 'odt',
      stats,
    }
  }

  /**
   * Generate content.xml with document content.
   */
  private generateContentXml(
    document: ProseMirrorNode,
    _pageDimensions: PageDimensions,
    options: ODTExportOptions
  ): string {
    const bodyContent = this.convertDocument(document, options)

    return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  office:version="1.3">
  <office:automatic-styles>
    <style:style style:name="Bold" style:family="text">
      <style:text-properties fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Italic" style:family="text">
      <style:text-properties fo:font-style="italic"/>
    </style:style>
    <style:style style:name="Underline" style:family="text">
      <style:text-properties style:text-underline-style="solid" style:text-underline-width="auto"/>
    </style:style>
    <style:style style:name="Strike" style:family="text">
      <style:text-properties style:text-line-through-style="solid"/>
    </style:style>
    <style:style style:name="Code" style:family="text">
      <style:text-properties style:font-name="Courier New" fo:font-size="10pt"/>
    </style:style>
    <style:style style:name="CodeBlock" style:family="paragraph">
      <style:paragraph-properties fo:background-color="#f5f5f5" fo:padding="0.2cm"/>
      <style:text-properties style:font-name="Courier New" fo:font-size="10pt"/>
    </style:style>
    <style:style style:name="Blockquote" style:family="paragraph">
      <style:paragraph-properties fo:margin-left="1cm" fo:border-left="0.1cm solid #cccccc" fo:padding-left="0.3cm"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
${bodyContent}
    </office:text>
  </office:body>
</office:document-content>`
  }

  /**
   * Generate styles.xml with page layout and default styles.
   */
  private generateStylesXml(pageDimensions: PageDimensions): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.3">
  <office:automatic-styles>
    <style:page-layout style:name="pm1">
      <style:page-layout-properties
        fo:page-width="${pointsToCm(pageDimensions.width)}"
        fo:page-height="${pointsToCm(pageDimensions.height)}"
        fo:margin-top="${pointsToCm(pageDimensions.margins.top)}"
        fo:margin-right="${pointsToCm(pageDimensions.margins.right)}"
        fo:margin-bottom="${pointsToCm(pageDimensions.margins.bottom)}"
        fo:margin-left="${pointsToCm(pageDimensions.margins.left)}"/>
    </style:page-layout>
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Standard" style:page-layout-name="pm1"/>
  </office:master-styles>
  <office:styles>
    <style:style style:name="Standard" style:family="paragraph" style:class="text">
      <style:text-properties fo:font-size="12pt" style:font-name="Liberation Serif"/>
    </style:style>
    <style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph" style:parent-style-name="Heading" style:next-style-name="Standard" style:class="text">
      <style:text-properties fo:font-size="24pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading_20_2" style:display-name="Heading 2" style:family="paragraph" style:parent-style-name="Heading" style:next-style-name="Standard" style:class="text">
      <style:text-properties fo:font-size="20pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading_20_3" style:display-name="Heading 3" style:family="paragraph" style:parent-style-name="Heading" style:next-style-name="Standard" style:class="text">
      <style:text-properties fo:font-size="16pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading_20_4" style:display-name="Heading 4" style:family="paragraph" style:parent-style-name="Heading" style:next-style-name="Standard" style:class="text">
      <style:text-properties fo:font-size="14pt" fo:font-weight="bold"/>
    </style:style>
  </office:styles>
</office:document-styles>`
  }

  /**
   * Generate meta.xml with document metadata.
   */
  private generateMetaXml(metadata?: DocumentMetadata): string {
    const now = new Date().toISOString()

    return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
  office:version="1.3">
  <office:meta>
    <meta:creation-date>${metadata?.creationDate?.toISOString() || now}</meta:creation-date>
    <dc:date>${metadata?.modificationDate?.toISOString() || now}</dc:date>
    ${metadata?.title ? `<dc:title>${escapeXml(metadata.title)}</dc:title>` : ''}
    ${metadata?.author ? `<dc:creator>${escapeXml(metadata.author)}</dc:creator>` : ''}
    ${metadata?.subject ? `<dc:subject>${escapeXml(metadata.subject)}</dc:subject>` : ''}
    ${metadata?.keywords?.length ? `<meta:keyword>${escapeXml(metadata.keywords.join(', '))}</meta:keyword>` : ''}
    <meta:generator>WriterKit ODT Exporter</meta:generator>
  </office:meta>
</office:document-meta>`
  }

  /**
   * Generate manifest.xml listing all files in the package.
   */
  private generateManifestXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest
  xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"
  manifest:version="1.3">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`
  }

  /**
   * Convert ProseMirror document to ODT XML content.
   */
  private convertDocument(
    document: ProseMirrorNode,
    options: ODTExportOptions
  ): string {
    const parts: string[] = []

    document.forEach((node) => {
      const xml = this.convertNode(node, options)
      if (xml) {
        parts.push(xml)
      }
    })

    return parts.join('\n')
  }

  /**
   * Convert a single node to ODT XML.
   */
  private convertNode(
    node: ProseMirrorNode,
    options: ODTExportOptions
  ): string | null {
    const nodeType = node.type.name

    switch (nodeType) {
      case 'paragraph':
        return this.convertParagraph(node)
      case 'heading':
        return this.convertHeading(node)
      case 'bulletList':
        return this.convertBulletList(node, options)
      case 'orderedList':
        return this.convertOrderedList(node, options)
      case 'codeBlock':
        return this.convertCodeBlock(node)
      case 'blockquote':
        return this.convertBlockquote(node, options)
      case 'horizontalRule':
        return '<text:p text:style-name="Horizontal_20_Line"/>'
      case 'pageBreak':
        return '<text:soft-page-break/>'
      case 'table':
        return this.convertTable(node, options)
      default:
        if (node.textContent) {
          return `<text:p>${this.convertInlineContent(node)}</text:p>`
        }
        return null
    }
  }

  /**
   * Convert paragraph node.
   */
  private convertParagraph(node: ProseMirrorNode): string {
    const content = this.convertInlineContent(node)
    return `      <text:p text:style-name="Standard">${content}</text:p>`
  }

  /**
   * Convert heading node.
   */
  private convertHeading(node: ProseMirrorNode): string {
    const level = node.attrs.level || 1
    const content = this.convertInlineContent(node)
    return `      <text:h text:style-name="Heading_20_${level}" text:outline-level="${level}">${content}</text:h>`
  }

  /**
   * Convert bullet list.
   */
  private convertBulletList(node: ProseMirrorNode, options: ODTExportOptions): string {
    const items: string[] = []

    node.forEach((listItem) => {
      const itemContent: string[] = []
      listItem.forEach((child) => {
        if (child.type.name === 'paragraph') {
          itemContent.push(`<text:p>${this.convertInlineContent(child)}</text:p>`)
        } else {
          const xml = this.convertNode(child, options)
          if (xml) itemContent.push(xml)
        }
      })
      items.push(`        <text:list-item>\n${itemContent.join('\n')}\n        </text:list-item>`)
    })

    return `      <text:list text:style-name="List_20_1">\n${items.join('\n')}\n      </text:list>`
  }

  /**
   * Convert ordered list.
   */
  private convertOrderedList(node: ProseMirrorNode, options: ODTExportOptions): string {
    const items: string[] = []

    node.forEach((listItem) => {
      const itemContent: string[] = []
      listItem.forEach((child) => {
        if (child.type.name === 'paragraph') {
          itemContent.push(`<text:p>${this.convertInlineContent(child)}</text:p>`)
        } else {
          const xml = this.convertNode(child, options)
          if (xml) itemContent.push(xml)
        }
      })
      items.push(`        <text:list-item>\n${itemContent.join('\n')}\n        </text:list-item>`)
    })

    return `      <text:list text:style-name="Numbering_20_1">\n${items.join('\n')}\n      </text:list>`
  }

  /**
   * Convert code block.
   */
  private convertCodeBlock(node: ProseMirrorNode): string {
    const text = escapeXml(node.textContent)
    const lines = text.split('\n')
    const xmlLines = lines.map((line) => `      <text:p text:style-name="CodeBlock">${line}</text:p>`)
    return xmlLines.join('\n')
  }

  /**
   * Convert blockquote.
   */
  private convertBlockquote(node: ProseMirrorNode, options: ODTExportOptions): string {
    const parts: string[] = []

    node.forEach((child) => {
      if (child.type.name === 'paragraph') {
        parts.push(`      <text:p text:style-name="Blockquote">${this.convertInlineContent(child)}</text:p>`)
      } else {
        const xml = this.convertNode(child, options)
        if (xml) parts.push(xml)
      }
    })

    return parts.join('\n')
  }

  /**
   * Convert table.
   */
  private convertTable(node: ProseMirrorNode, _options: ODTExportOptions): string {
    const rows: string[] = []
    let colCount = 0

    node.forEach((rowNode, _offset, rowIndex) => {
      if (rowNode.type.name === 'tableRow') {
        const cells: string[] = []

        rowNode.forEach((cellNode) => {
          if (cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') {
            const cellContent: string[] = []
            cellNode.forEach((child) => {
              if (child.type.name === 'paragraph') {
                cellContent.push(`<text:p>${this.convertInlineContent(child)}</text:p>`)
              }
            })
            cells.push(`          <table:table-cell>\n            ${cellContent.join('\n            ')}\n          </table:table-cell>`)
          }
        })

        if (rowIndex === 0) {
          colCount = cells.length
        }

        rows.push(`        <table:table-row>\n${cells.join('\n')}\n        </table:table-row>`)
      }
    })

    const columns = Array(colCount)
      .fill('')
      .map(() => '        <table:table-column/>')
      .join('\n')

    return `      <table:table table:style-name="Table1">
${columns}
${rows.join('\n')}
      </table:table>`
  }

  /**
   * Convert inline content to ODT XML.
   */
  private convertInlineContent(node: ProseMirrorNode): string {
    const parts: string[] = []

    node.forEach((child) => {
      if (child.isText) {
        const text = escapeXml(child.text || '')
        const spans = this.wrapWithStyles(text, child.marks)
        parts.push(spans)
      } else if (child.type.name === 'hardBreak') {
        parts.push('<text:line-break/>')
      }
    })

    return parts.join('')
  }

  /**
   * Wrap text with style spans based on marks.
   */
  private wrapWithStyles(text: string, marks: readonly Mark[]): string {
    if (marks.length === 0) {
      return text
    }

    let result = text

    // Check for link first
    const linkMark = marks.find((m) => m.type.name === 'link')
    if (linkMark) {
      result = `<text:a xlink:href="${escapeXml(linkMark.attrs.href)}">${result}</text:a>`
    }

    // Apply text styles
    for (const mark of marks) {
      switch (mark.type.name) {
        case 'bold':
        case 'strong':
          result = `<text:span text:style-name="Bold">${result}</text:span>`
          break
        case 'italic':
        case 'em':
          result = `<text:span text:style-name="Italic">${result}</text:span>`
          break
        case 'underline':
          result = `<text:span text:style-name="Underline">${result}</text:span>`
          break
        case 'strike':
        case 'strikethrough':
          result = `<text:span text:style-name="Strike">${result}</text:span>`
          break
        case 'code':
          result = `<text:span text:style-name="Code">${result}</text:span>`
          break
      }
    }

    return result
  }

  /**
   * Create a ZIP file from the given entries.
   * Uses a simple uncompressed ZIP format.
   */
  private async createZip(entries: Record<string, string>): Promise<ArrayBuffer> {
    // Simple ZIP implementation for basic ODT support
    // For production, consider using a proper ZIP library like JSZip

    const encoder = new TextEncoder()
    const files: { name: string; data: Uint8Array; offset: number }[] = []

    // Convert entries to binary
    for (const [name, content] of Object.entries(entries)) {
      files.push({
        name,
        data: encoder.encode(content),
        offset: 0,
      })
    }

    // Calculate offsets and build ZIP
    let offset = 0
    const localHeaders: Uint8Array[] = []
    const centralHeaders: Uint8Array[] = []

    for (const file of files) {
      file.offset = offset

      // Local file header
      const nameBytes = encoder.encode(file.name)
      const localHeader = new Uint8Array(30 + nameBytes.length + file.data.length)
      const localView = new DataView(localHeader.buffer)

      // Signature
      localView.setUint32(0, 0x04034b50, true)
      // Version needed
      localView.setUint16(4, 20, true)
      // Flags
      localView.setUint16(6, 0, true)
      // Compression (0 = store)
      localView.setUint16(8, 0, true)
      // Mod time/date
      localView.setUint16(10, 0, true)
      localView.setUint16(12, 0, true)
      // CRC32 (simplified - should calculate properly)
      localView.setUint32(14, this.crc32(file.data), true)
      // Compressed size
      localView.setUint32(18, file.data.length, true)
      // Uncompressed size
      localView.setUint32(22, file.data.length, true)
      // File name length
      localView.setUint16(26, nameBytes.length, true)
      // Extra field length
      localView.setUint16(28, 0, true)
      // File name
      localHeader.set(nameBytes, 30)
      // File data
      localHeader.set(file.data, 30 + nameBytes.length)

      localHeaders.push(localHeader)
      offset += localHeader.length

      // Central directory header
      const centralHeader = new Uint8Array(46 + nameBytes.length)
      const centralView = new DataView(centralHeader.buffer)

      // Signature
      centralView.setUint32(0, 0x02014b50, true)
      // Version made by
      centralView.setUint16(4, 20, true)
      // Version needed
      centralView.setUint16(6, 20, true)
      // Flags
      centralView.setUint16(8, 0, true)
      // Compression
      centralView.setUint16(10, 0, true)
      // Mod time/date
      centralView.setUint16(12, 0, true)
      centralView.setUint16(14, 0, true)
      // CRC32
      centralView.setUint32(16, this.crc32(file.data), true)
      // Compressed size
      centralView.setUint32(20, file.data.length, true)
      // Uncompressed size
      centralView.setUint32(24, file.data.length, true)
      // File name length
      centralView.setUint16(28, nameBytes.length, true)
      // Extra field length
      centralView.setUint16(30, 0, true)
      // Comment length
      centralView.setUint16(32, 0, true)
      // Disk number start
      centralView.setUint16(34, 0, true)
      // Internal attributes
      centralView.setUint16(36, 0, true)
      // External attributes
      centralView.setUint32(38, 0, true)
      // Offset of local header
      centralView.setUint32(42, file.offset, true)
      // File name
      centralHeader.set(nameBytes, 46)

      centralHeaders.push(centralHeader)
    }

    // End of central directory
    const centralDirOffset = offset
    let centralDirSize = 0
    for (const header of centralHeaders) {
      centralDirSize += header.length
    }

    const endRecord = new Uint8Array(22)
    const endView = new DataView(endRecord.buffer)
    // Signature
    endView.setUint32(0, 0x06054b50, true)
    // Disk number
    endView.setUint16(4, 0, true)
    // Disk with central dir
    endView.setUint16(6, 0, true)
    // Entries on this disk
    endView.setUint16(8, files.length, true)
    // Total entries
    endView.setUint16(10, files.length, true)
    // Central dir size
    endView.setUint32(12, centralDirSize, true)
    // Central dir offset
    endView.setUint32(16, centralDirOffset, true)
    // Comment length
    endView.setUint16(20, 0, true)

    // Combine all parts
    const totalSize = offset + centralDirSize + 22
    const result = new Uint8Array(totalSize)
    let pos = 0

    for (const header of localHeaders) {
      result.set(header, pos)
      pos += header.length
    }
    for (const header of centralHeaders) {
      result.set(header, pos)
      pos += header.length
    }
    result.set(endRecord, pos)

    return result.buffer
  }

  /**
   * Calculate CRC32 checksum.
   */
  private crc32(data: Uint8Array): number {
    let crc = 0xffffffff

    // CRC32 lookup table
    const table = this.getCrc32Table()

    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff]
    }

    return (crc ^ 0xffffffff) >>> 0
  }

  private crc32Table: Uint32Array | null = null

  private getCrc32Table(): Uint32Array {
    if (this.crc32Table) return this.crc32Table

    this.crc32Table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      this.crc32Table[i] = c
    }
    return this.crc32Table
  }

  getMimeType(): string {
    return 'application/vnd.oasis.opendocument.text'
  }

  getExtension(): string {
    return 'odt'
  }

  getFormatName(): 'odt' {
    return 'odt'
  }
}
