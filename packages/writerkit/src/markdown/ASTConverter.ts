import type { JSONContent } from '../core'
import type {
  Root,
  Content,
  Paragraph,
  Heading,
  Text,
  Strong,
  Emphasis,
  InlineCode,
  Code,
  Blockquote,
  List,
  ListItem,
  Link,
  Image,
  Html,
  Table,
  TableRow,
  TableCell,
  PhrasingContent,
  RootContent,
  BlockContent,
} from 'mdast'
import type { WriterKitRoot, PageBreakNode, ConverterConfig } from './types'

/**
 * Converts between mdast AST and ProseMirror JSON.
 *
 * Handles bidirectional conversion:
 * - mdast → ProseMirror: For loading markdown into the editor
 * - ProseMirror → mdast: For saving editor content to markdown
 *
 * @example
 * ```typescript
 * const converter = new ASTConverter()
 *
 * // Parse markdown to AST, then convert to ProseMirror
 * const pm = converter.toProseMirror(ast)
 *
 * // Convert ProseMirror back to AST for serialization
 * const mdast = converter.toMdast(pm)
 * ```
 */
export class ASTConverter {
  private config: ConverterConfig

  constructor(config: ConverterConfig = {}) {
    this.config = config
  }

  /**
   * Convert mdast AST to ProseMirror JSON
   */
  toProseMirror(ast: WriterKitRoot | Root): JSONContent {
    return {
      type: 'doc',
      content: this.convertChildren(ast.children as Content[]),
    }
  }

  /**
   * Convert ProseMirror JSON to mdast AST
   */
  toMdast(doc: JSONContent): WriterKitRoot {
    return {
      type: 'root',
      children: this.convertProseMirrorChildren(doc.content ?? []),
    }
  }

  /**
   * Convert mdast children to ProseMirror content
   */
  private convertChildren(children: Content[]): JSONContent[] {
    const result: JSONContent[] = []

    for (const child of children) {
      const converted = this.convertNode(child)
      if (converted) {
        if (Array.isArray(converted)) {
          result.push(...converted)
        } else {
          result.push(converted)
        }
      }
    }

    return result
  }

  /**
   * Convert a single mdast node to ProseMirror JSON
   */
  private convertNode(node: Content | PageBreakNode): JSONContent | JSONContent[] | null {
    switch (node.type) {
      case 'paragraph':
        return this.convertParagraph(node as Paragraph)
      case 'heading':
        return this.convertHeading(node as Heading)
      case 'text':
        return this.convertText(node as Text)
      case 'strong':
        return this.convertStrong(node as Strong)
      case 'emphasis':
        return this.convertEmphasis(node as Emphasis)
      case 'inlineCode':
        return this.convertInlineCode(node as InlineCode)
      case 'code':
        return this.convertCodeBlock(node as Code)
      case 'blockquote':
        return this.convertBlockquote(node as Blockquote)
      case 'list':
        return this.convertList(node as List)
      case 'listItem':
        return this.convertListItem(node as ListItem)
      case 'link':
        return this.convertLink(node as Link)
      case 'image':
        return this.convertImage(node as Image)
      case 'thematicBreak':
        return this.convertThematicBreak()
      case 'break':
        return this.convertHardBreak()
      case 'html':
        return this.convertHtml(node as Html)
      case 'table':
        return this.convertTable(node as Table)
      case 'pageBreak':
        return this.convertPageBreak()
      default:
        if (this.config.preserveUnknown) {
          return {
            type: 'unknown',
            attrs: { originalType: (node as Content).type },
          }
        }
        return null
    }
  }

  private convertParagraph(node: Paragraph): JSONContent {
    return {
      type: 'paragraph',
      content: this.convertInlineContent(node.children),
    }
  }

  private convertHeading(node: Heading): JSONContent {
    return {
      type: 'heading',
      attrs: { level: node.depth },
      content: this.convertInlineContent(node.children),
    }
  }

  private convertText(node: Text): JSONContent {
    return {
      type: 'text',
      text: node.value,
    }
  }

  private convertStrong(node: Strong): JSONContent[] {
    // Strong wraps its children with a bold mark
    return this.convertInlineContent(node.children).map((child) => ({
      ...child,
      marks: [...(child.marks ?? []), { type: 'bold' }],
    }))
  }

  private convertEmphasis(node: Emphasis): JSONContent[] {
    // Emphasis wraps its children with an italic mark
    return this.convertInlineContent(node.children).map((child) => ({
      ...child,
      marks: [...(child.marks ?? []), { type: 'italic' }],
    }))
  }

  private convertInlineCode(node: InlineCode): JSONContent {
    return {
      type: 'text',
      text: node.value,
      marks: [{ type: 'code' }],
    }
  }

  private convertCodeBlock(node: Code): JSONContent {
    return {
      type: 'codeBlock',
      attrs: { language: node.lang ?? null },
      content: [{ type: 'text', text: node.value }],
    }
  }

  private convertBlockquote(node: Blockquote): JSONContent {
    return {
      type: 'blockquote',
      content: this.convertChildren(node.children as Content[]),
    }
  }

  private convertList(node: List): JSONContent {
    return {
      type: node.ordered ? 'orderedList' : 'bulletList',
      attrs: node.ordered ? { start: node.start ?? 1 } : undefined,
      content: this.convertChildren(node.children as Content[]),
    }
  }

  private convertListItem(node: ListItem): JSONContent {
    return {
      type: 'listItem',
      content: this.convertChildren(node.children as Content[]),
    }
  }

  private convertLink(node: Link): JSONContent {
    const content = this.convertInlineContent(node.children)
    return {
      type: 'text',
      text: content.map((c) => c.text ?? '').join(''),
      marks: [
        {
          type: 'link',
          attrs: {
            href: node.url,
            title: node.title ?? null,
          },
        },
      ],
    }
  }

  private convertImage(node: Image): JSONContent {
    return {
      type: 'image',
      attrs: {
        src: node.url,
        alt: node.alt ?? null,
        title: node.title ?? null,
      },
    }
  }

  private convertThematicBreak(): JSONContent {
    return { type: 'horizontalRule' }
  }

  private convertHardBreak(): JSONContent {
    return { type: 'hardBreak' }
  }

  private convertHtml(node: Html): JSONContent | null {
    // Check for page break comment
    if (/<!--\s*page-break\s*-->/i.test(node.value)) {
      return this.convertPageBreak()
    }

    // Other HTML - could be preserved or ignored
    if (this.config.preserveUnknown) {
      return {
        type: 'html',
        attrs: { content: node.value },
      }
    }

    return null
  }

  private convertTable(node: Table): JSONContent {
    return {
      type: 'table',
      content: node.children.map((row) => this.convertTableRow(row)),
    }
  }

  private convertTableRow(row: TableRow): JSONContent {
    return {
      type: 'tableRow',
      content: row.children.map((cell) => this.convertTableCell(cell)),
    }
  }

  private convertTableCell(cell: TableCell): JSONContent {
    return {
      type: 'tableCell',
      content: this.convertChildren(cell.children as Content[]),
    }
  }

  private convertPageBreak(): JSONContent {
    return { type: 'pageBreak' }
  }

  /**
   * Convert inline content (phrasing content) to ProseMirror
   */
  private convertInlineContent(children: PhrasingContent[]): JSONContent[] {
    const result: JSONContent[] = []

    for (const child of children) {
      switch (child.type) {
        case 'text':
          result.push(this.convertText(child))
          break
        case 'strong':
          result.push(...this.convertStrong(child))
          break
        case 'emphasis':
          result.push(...this.convertEmphasis(child))
          break
        case 'inlineCode':
          result.push(this.convertInlineCode(child))
          break
        case 'link':
          result.push(this.convertLink(child))
          break
        case 'image':
          result.push(this.convertImage(child))
          break
        case 'break':
          result.push(this.convertHardBreak())
          break
        default:
          // Skip unknown inline content
          break
      }
    }

    return result
  }

  // =====================================
  // ProseMirror → mdast conversion
  // =====================================

  /**
   * Convert ProseMirror children to mdast content
   */
  private convertProseMirrorChildren(children: JSONContent[]): RootContent[] {
    const result: RootContent[] = []

    for (const child of children) {
      const converted = this.convertProseMirrorNode(child)
      if (converted) {
        result.push(converted)
      }
    }

    return result
  }

  /**
   * Convert a single ProseMirror node to mdast
   */
  private convertProseMirrorNode(node: JSONContent): RootContent | null {
    switch (node.type) {
      case 'paragraph':
        return this.pmToParagraph(node)
      case 'heading':
        return this.pmToHeading(node)
      case 'codeBlock':
        return this.pmToCodeBlock(node)
      case 'blockquote':
        return this.pmToBlockquote(node)
      case 'bulletList':
        return this.pmToList(node, false)
      case 'orderedList':
        return this.pmToList(node, true)
      case 'listItem':
        return this.pmToListItem(node) as unknown as RootContent
      case 'horizontalRule':
        return { type: 'thematicBreak' }
      case 'image':
        return this.pmToImage(node) as unknown as RootContent
      case 'table':
        return this.pmToTable(node)
      case 'pageBreak':
        return { type: 'html', value: '<!-- page-break -->' } as Html
      default:
        return null
    }
  }

  private pmToParagraph(node: JSONContent): Paragraph {
    return {
      type: 'paragraph',
      children: this.convertProseMirrorInline(node.content ?? []),
    }
  }

  private pmToHeading(node: JSONContent): Heading {
    const level = (node.attrs?.level ?? 1) as 1 | 2 | 3 | 4 | 5 | 6
    return {
      type: 'heading',
      depth: level,
      children: this.convertProseMirrorInline(node.content ?? []),
    }
  }

  private pmToCodeBlock(node: JSONContent): Code {
    const text = node.content?.[0]?.text ?? ''
    return {
      type: 'code',
      lang: (node.attrs?.language as string) ?? undefined,
      value: text,
    }
  }

  private pmToBlockquote(node: JSONContent): Blockquote {
    return {
      type: 'blockquote',
      children: this.convertProseMirrorChildren(node.content ?? []) as BlockContent[],
    }
  }

  private pmToList(node: JSONContent, ordered: boolean): List {
    return {
      type: 'list',
      ordered,
      start: ordered ? ((node.attrs?.start as number) ?? 1) : undefined,
      spread: false,
      children: (node.content ?? []).map((item) => this.pmToListItem(item)),
    }
  }

  private pmToListItem(node: JSONContent): ListItem {
    return {
      type: 'listItem',
      spread: false,
      children: this.convertProseMirrorChildren(node.content ?? []) as BlockContent[],
    }
  }

  private pmToImage(node: JSONContent): Image {
    return {
      type: 'image',
      url: (node.attrs?.src as string) ?? '',
      alt: (node.attrs?.alt as string) ?? undefined,
      title: (node.attrs?.title as string) ?? undefined,
    }
  }

  private pmToTable(node: JSONContent): Table {
    return {
      type: 'table',
      children: (node.content ?? []).map((row) => this.pmToTableRow(row)),
    }
  }

  private pmToTableRow(node: JSONContent): TableRow {
    return {
      type: 'tableRow',
      children: (node.content ?? []).map((cell) => this.pmToTableCell(cell)),
    }
  }

  private pmToTableCell(node: JSONContent): TableCell {
    return {
      type: 'tableCell',
      children: this.convertProseMirrorChildren(node.content ?? []) as PhrasingContent[],
    }
  }

  /**
   * Convert ProseMirror inline content to mdast phrasing content
   */
  private convertProseMirrorInline(nodes: JSONContent[]): PhrasingContent[] {
    const result: PhrasingContent[] = []

    for (const node of nodes) {
      if (node.type === 'text') {
        const text: Text = { type: 'text', value: node.text ?? '' }

        // Apply marks
        if (node.marks && node.marks.length > 0) {
          let wrapped: PhrasingContent | null = text

          for (const mark of node.marks) {
            if (!wrapped) break

            switch (mark.type) {
              case 'bold':
                wrapped = { type: 'strong', children: [wrapped] }
                break
              case 'italic':
                wrapped = { type: 'emphasis', children: [wrapped] }
                break
              case 'code':
                result.push({ type: 'inlineCode', value: node.text ?? '' })
                wrapped = null // Skip normal push
                break
              case 'link':
                wrapped = {
                  type: 'link',
                  url: (mark.attrs?.href as string) ?? '',
                  title: (mark.attrs?.title as string) ?? undefined,
                  children: [text],
                }
                break
            }
          }

          if (wrapped) {
            result.push(wrapped)
          }
        } else {
          result.push(text)
        }
      } else if (node.type === 'hardBreak') {
        result.push({ type: 'break' })
      } else if (node.type === 'image') {
        result.push({
          type: 'image',
          url: (node.attrs?.src as string) ?? '',
          alt: (node.attrs?.alt as string) ?? undefined,
          title: (node.attrs?.title as string) ?? undefined,
        })
      }
    }

    return result
  }
}
