import { fromMarkdown } from 'mdast-util-from-markdown'
import { toMarkdown } from 'mdast-util-to-markdown'
import type { Root } from 'mdast'
import type { JSONContent, DocumentMetadata } from '../core'

import { Frontmatter, frontmatter } from './Frontmatter'
import { ASTConverter } from './ASTConverter'
import type {
  WriterKitRoot,
  ParseResult,
  SerializeResult,
  ParseOptions,
  SerializeOptions,
  ConverterConfig,
} from './types'

/**
 * Manages bidirectional markdown conversion for WriterKit.
 *
 * This is the main entry point for working with markdown:
 * - Parse markdown → metadata + ProseMirror JSON
 * - Serialize ProseMirror JSON → markdown
 *
 * @example
 * ```typescript
 * const manager = new MarkdownManager()
 *
 * // Parse markdown document
 * const { metadata, ast } = manager.parse(markdownString)
 *
 * // Convert to ProseMirror for editor
 * const pmJson = manager.astToProseMirror(ast)
 *
 * // Convert back to markdown for saving
 * const markdown = manager.serialize(pmJson, metadata)
 * ```
 */
export class MarkdownManager {
  private frontmatter: Frontmatter
  private converter: ASTConverter

  constructor(config: ConverterConfig = {}) {
    this.frontmatter = new Frontmatter()
    this.converter = new ASTConverter(config)
  }

  /**
   * Parse a markdown string into metadata and AST.
   *
   * @param markdown - Raw markdown content (may include frontmatter)
   * @param options - Parse options
   * @returns Parsed result with metadata, AST, and body
   */
  parse(markdown: string, options: ParseOptions = {}): ParseResult {
    // Extract frontmatter
    const { metadata, body } = this.frontmatter.parse(markdown)

    // Parse markdown body to mdast
    let ast = fromMarkdown(body) as WriterKitRoot

    // Convert page breaks if enabled
    if (options.convertPageBreaks !== false) {
      ast = this.convertPageBreaks(ast)
    }

    return { metadata, ast, body }
  }

  /**
   * Serialize ProseMirror JSON and metadata back to markdown.
   *
   * @param doc - ProseMirror document JSON
   * @param metadata - Document metadata
   * @param options - Serialization options
   * @returns Serialized markdown string
   */
  serialize(
    doc: JSONContent,
    metadata: DocumentMetadata,
    options: SerializeOptions = {}
  ): SerializeResult {
    // Convert ProseMirror to mdast
    const ast = this.converter.toMdast(doc)

    // Convert mdast to markdown string
    const body = toMarkdown(ast as Root)

    // Build result
    if (options.includeFrontmatter !== false) {
      const markdown = this.frontmatter.serialize(
        metadata,
        body,
        { minimal: options.minimalFrontmatter }
      )

      return {
        markdown,
        frontmatter: this.extractFrontmatterString(markdown),
        body,
      }
    }

    return {
      markdown: body,
      frontmatter: '',
      body,
    }
  }

  /**
   * Convert mdast AST to ProseMirror JSON.
   */
  astToProseMirror(ast: WriterKitRoot | Root): JSONContent {
    return this.converter.toProseMirror(ast)
  }

  /**
   * Convert ProseMirror JSON to mdast AST.
   */
  proseMirrorToAST(doc: JSONContent): WriterKitRoot {
    return this.converter.toMdast(doc)
  }

  /**
   * Quick method to convert markdown directly to ProseMirror JSON.
   *
   * @param markdown - Raw markdown content
   * @returns ProseMirror JSON and metadata
   */
  markdownToProseMirror(markdown: string): {
    doc: JSONContent
    metadata: DocumentMetadata
  } {
    const { metadata, ast } = this.parse(markdown)
    const doc = this.astToProseMirror(ast)
    return { doc, metadata }
  }

  /**
   * Quick method to convert ProseMirror JSON directly to markdown.
   *
   * @param doc - ProseMirror document JSON
   * @param metadata - Document metadata
   * @returns Markdown string
   */
  proseMirrorToMarkdown(doc: JSONContent, metadata: DocumentMetadata): string {
    const { markdown } = this.serialize(doc, metadata)
    return markdown
  }

  /**
   * Get default document metadata.
   */
  getDefaultMetadata(): DocumentMetadata {
    return this.frontmatter.getDefaults()
  }

  /**
   * Update the modified timestamp in metadata.
   */
  updateModifiedAt(metadata: DocumentMetadata): DocumentMetadata {
    return this.frontmatter.updateModifiedAt(metadata)
  }

  /**
   * Check if content has frontmatter.
   */
  hasFrontmatter(content: string): boolean {
    return this.frontmatter.hasFrontmatter(content)
  }

  /**
   * Convert HTML page break comments to pageBreak nodes in the AST.
   */
  private convertPageBreaks(ast: WriterKitRoot): WriterKitRoot {
    const convert = (children: unknown[]): unknown[] => {
      return children.map((node: unknown) => {
        const n = node as { type: string; value?: string; children?: unknown[] }

        // Check if this is a page break HTML comment
        if (n.type === 'html' && typeof n.value === 'string') {
          if (/<!--\s*page-break\s*-->/i.test(n.value)) {
            return { type: 'pageBreak' }
          }
        }

        // Recursively process children if they exist
        if (n.children && Array.isArray(n.children)) {
          return {
            ...n,
            children: convert(n.children),
          }
        }

        return node
      })
    }

    return {
      ...ast,
      children: convert(ast.children) as WriterKitRoot['children'],
    }
  }

  /**
   * Extract the frontmatter string from a markdown document.
   */
  private extractFrontmatterString(markdown: string): string {
    const match = markdown.match(/^---\n([\s\S]*?)\n---\n/)
    return match ? match[0] : ''
  }
}

/**
 * Singleton instance for convenience
 */
export const markdownManager = new MarkdownManager()

/**
 * Re-export frontmatter singleton
 */
export { frontmatter }
