import { YAMLParser } from './YAMLParser'
import { YAMLStringifier } from './YAMLStringifier'
import type { DocumentMetadata } from '../core'

const yamlParser = new YAMLParser()
const yamlStringifier = new YAMLStringifier()

/**
 * Default document metadata values
 */
const DEFAULT_METADATA: DocumentMetadata = {
  title: 'Untitled',
  createdAt: new Date().toISOString(),
  modifiedAt: new Date().toISOString(),
}

/**
 * Handles YAML frontmatter parsing and serialization.
 *
 * Frontmatter format:
 * ```markdown
 * ---
 * title: My Document
 * author: John Doe
 * createdAt: 2024-01-01T00:00:00.000Z
 * modifiedAt: 2024-01-02T00:00:00.000Z
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
    const { data, content: body } = yamlParser.extractFrontmatter(content)

    // Merge with defaults
    const metadata = this.mergeWithDefaults(data as Partial<DocumentMetadata>)

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

    // Use custom YAML stringifier
    return yamlStringifier.stringifyWithContent(
      frontmatterData as Record<string, unknown>,
      body
    )
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
      ...data,
      title: data.title ?? defaults.title,
      createdAt: data.createdAt ?? defaults.createdAt,
      modifiedAt: data.modifiedAt ?? defaults.modifiedAt,
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

    // Include any additional custom fields
    for (const [key, value] of Object.entries(metadata)) {
      if (!['title', 'author', 'createdAt', 'modifiedAt'].includes(key) && value !== undefined) {
        ;(result as Record<string, unknown>)[key] = value
      }
    }

    return result
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
