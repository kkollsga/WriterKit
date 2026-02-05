import matter from 'gray-matter'
import type { DocumentMetadata, Margins, HeaderFooterConfig } from '@writerkit/core'

/**
 * Default document metadata values
 */
const DEFAULT_METADATA: DocumentMetadata = {
  title: 'Untitled',
  createdAt: new Date().toISOString(),
  modifiedAt: new Date().toISOString(),
  pageSize: 'a4',
  orientation: 'portrait',
  margins: {
    top: 72,
    right: 72,
    bottom: 72,
    left: 72,
  },
}

/**
 * Handles YAML frontmatter parsing and serialization.
 *
 * Frontmatter format:
 * ```markdown
 * ---
 * title: My Document
 * author: John Doe
 * pageSize: a4
 * margins:
 *   top: 72
 *   right: 72
 *   bottom: 72
 *   left: 72
 * ---
 *
 * Document content here...
 * ```
 */
export class Frontmatter {
  /**
   * Parse markdown content and extract frontmatter metadata
   *
   * @param content - Raw markdown content with optional frontmatter
   * @returns Parsed metadata and body content
   */
  parse(content: string): { metadata: DocumentMetadata; body: string } {
    const { data, content: body } = matter(content)

    // Deep merge with defaults
    const metadata = this.mergeWithDefaults(data as Partial<DocumentMetadata>)

    // Validate the merged metadata
    this.validate(metadata)

    return { metadata, body }
  }

  /**
   * Serialize metadata and body content back to markdown with frontmatter
   *
   * @param metadata - Document metadata
   * @param body - Document body content
   * @param options - Serialization options
   */
  serialize(
    metadata: DocumentMetadata,
    body: string,
    options: { minimal?: boolean } = {}
  ): string {
    const frontmatterData = options.minimal
      ? this.removeDefaults(metadata)
      : this.removeUndefined(metadata)

    // Use gray-matter to stringify
    return matter.stringify(body, frontmatterData)
  }

  /**
   * Remove undefined values from an object (for YAML serialization)
   */
  private removeUndefined(obj: DocumentMetadata): Partial<DocumentMetadata> {
    const result: Partial<DocumentMetadata> = {}

    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        ;(result as Record<string, unknown>)[key] = value
      }
    }

    return result
  }

  /**
   * Get default metadata values
   */
  getDefaults(): DocumentMetadata {
    return { ...DEFAULT_METADATA }
  }

  /**
   * Deep merge parsed data with default values
   */
  private mergeWithDefaults(data: Partial<DocumentMetadata>): DocumentMetadata {
    const defaults = this.getDefaults()

    return {
      title: data.title ?? defaults.title,
      author: data.author,
      createdAt: data.createdAt ?? defaults.createdAt,
      modifiedAt: data.modifiedAt ?? defaults.modifiedAt,
      pageSize: data.pageSize ?? defaults.pageSize,
      orientation: data.orientation ?? defaults.orientation,
      margins: this.mergeMargins(data.margins, defaults.margins),
      header: data.header ? this.normalizeHeaderFooter(data.header) : undefined,
      footer: data.footer ? this.normalizeHeaderFooter(data.footer) : undefined,
    }
  }

  /**
   * Merge margins with defaults
   */
  private mergeMargins(
    margins: Partial<Margins> | undefined,
    defaults: Margins
  ): Margins {
    if (!margins) return defaults

    return {
      top: margins.top ?? defaults.top,
      right: margins.right ?? defaults.right,
      bottom: margins.bottom ?? defaults.bottom,
      left: margins.left ?? defaults.left,
    }
  }

  /**
   * Normalize header/footer config
   */
  private normalizeHeaderFooter(
    config: Partial<HeaderFooterConfig>
  ): HeaderFooterConfig {
    return {
      left: config.left,
      center: config.center,
      right: config.right,
      showOnFirstPage: config.showOnFirstPage ?? true,
    }
  }

  /**
   * Remove default values to create minimal frontmatter
   */
  private removeDefaults(
    metadata: DocumentMetadata
  ): Partial<DocumentMetadata> {
    const defaults = this.getDefaults()
    const result: Partial<DocumentMetadata> = {}

    // Title is always included if non-default
    if (metadata.title !== defaults.title) {
      result.title = metadata.title
    }

    // Author is optional
    if (metadata.author) {
      result.author = metadata.author
    }

    // Timestamps are always included
    result.createdAt = metadata.createdAt
    result.modifiedAt = metadata.modifiedAt

    // Page settings only if non-default
    if (metadata.pageSize !== defaults.pageSize) {
      result.pageSize = metadata.pageSize
    }

    if (metadata.orientation !== defaults.orientation) {
      result.orientation = metadata.orientation
    }

    // Margins only if different from default
    if (!this.marginsEqual(metadata.margins, defaults.margins)) {
      result.margins = metadata.margins
    }

    // Header/footer only if present
    if (metadata.header) {
      result.header = metadata.header
    }

    if (metadata.footer) {
      result.footer = metadata.footer
    }

    return result
  }

  /**
   * Compare two margin objects for equality
   */
  private marginsEqual(a: Margins, b: Margins): boolean {
    return (
      a.top === b.top &&
      a.right === b.right &&
      a.bottom === b.bottom &&
      a.left === b.left
    )
  }

  /**
   * Validate metadata values
   */
  private validate(metadata: DocumentMetadata): void {
    const validPageSizes = ['a4', 'letter', 'legal', 'a3', 'a5']
    const validOrientations = ['portrait', 'landscape']

    if (!validPageSizes.includes(metadata.pageSize)) {
      throw new Error(
        `Invalid page size: ${metadata.pageSize}. Must be one of: ${validPageSizes.join(', ')}`
      )
    }

    if (!validOrientations.includes(metadata.orientation)) {
      throw new Error(
        `Invalid orientation: ${metadata.orientation}. Must be one of: ${validOrientations.join(', ')}`
      )
    }

    // Validate margins are positive numbers
    const { margins } = metadata
    for (const [key, value] of Object.entries(margins)) {
      if (typeof value !== 'number' || value < 0) {
        throw new Error(
          `Invalid margin.${key}: ${value}. Must be a positive number`
        )
      }
    }
  }

  /**
   * Update the modifiedAt timestamp
   */
  updateModifiedAt(metadata: DocumentMetadata): DocumentMetadata {
    return {
      ...metadata,
      modifiedAt: new Date().toISOString(),
    }
  }

  /**
   * Check if content has frontmatter
   */
  hasFrontmatter(content: string): boolean {
    return content.trimStart().startsWith('---')
  }
}

/**
 * Singleton instance for convenience
 */
export const frontmatter = new Frontmatter()
