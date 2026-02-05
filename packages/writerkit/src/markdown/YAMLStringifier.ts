/**
 * YAMLStringifier - Simple YAML serializer for frontmatter
 *
 * A lightweight YAML stringifier that handles the subset of YAML features
 * used in document frontmatter. Does not depend on Node.js APIs.
 *
 * Supported features:
 * - Key-value pairs
 * - Strings (with automatic quoting when needed)
 * - Numbers
 * - Booleans
 * - Nested objects (via indentation)
 */

import type { YAMLValue, YAMLObject } from './YAMLParser'

/**
 * Characters that require quoting in YAML strings
 */
const SPECIAL_CHARS = /[:{}[\],&*#?|\-<>=!%@`"'\\]/
const NEEDS_QUOTES = /^[\s'"]|[\s'"]$|:\s|#|^[0-9]|^(true|false|null|yes|no|on|off)$/i

/**
 * Simple YAML stringifier for frontmatter
 *
 * @example
 * ```typescript
 * const stringifier = new YAMLStringifier()
 * const yaml = stringifier.stringify({ title: 'My Doc', pageSize: 'a4' })
 * // title: My Doc
 * // pageSize: a4
 *
 * const markdown = stringifier.stringifyWithContent(data, 'Body content')
 * // ---
 * // title: My Doc
 * // ---
 * //
 * // Body content
 * ```
 */
export class YAMLStringifier {
  private indentStr = '  ' // 2 spaces

  /**
   * Stringify an object to YAML format
   *
   * @param data - Object to stringify
   * @returns YAML string
   */
  stringify(data: Record<string, unknown>): string {
    if (!data || Object.keys(data).length === 0) {
      return ''
    }

    const lines: string[] = []
    this.stringifyObject(data as YAMLObject, 0, lines)
    return lines.join('\n')
  }

  /**
   * Stringify an object with frontmatter delimiters and body content
   *
   * @param data - Frontmatter data object
   * @param content - Body content
   * @returns Full markdown with frontmatter
   */
  stringifyWithContent(data: Record<string, unknown>, content: string): string {
    const yaml = this.stringify(data)

    if (!yaml) {
      // No frontmatter data
      return content
    }

    // Build the output with frontmatter
    const parts = ['---', yaml, '---', '']

    // Add content
    if (content) {
      parts.push(content)
    }

    return parts.join('\n')
  }

  /**
   * Stringify an object at a given indentation level
   */
  private stringifyObject(
    obj: YAMLObject,
    indent: number,
    lines: string[]
  ): void {
    const prefix = this.indentStr.repeat(indent)

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        continue // Skip undefined values
      }

      if (value === null) {
        lines.push(`${prefix}${key}:`)
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Nested object
        lines.push(`${prefix}${key}:`)
        this.stringifyObject(value as YAMLObject, indent + 1, lines)
      } else if (Array.isArray(value)) {
        // Array
        lines.push(`${prefix}${key}:`)
        this.stringifyArray(value, indent + 1, lines)
      } else {
        // Simple value
        const stringValue = this.stringifyValue(value)
        lines.push(`${prefix}${key}: ${stringValue}`)
      }
    }
  }

  /**
   * Stringify an array
   */
  private stringifyArray(arr: YAMLValue[], indent: number, lines: string[]): void {
    const prefix = this.indentStr.repeat(indent)

    for (const item of arr) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Object item - format as mapping with - prefix
        lines.push(`${prefix}-`)
        this.stringifyObject(item as YAMLObject, indent + 1, lines)
      } else {
        // Simple value
        const stringValue = this.stringifyValue(item)
        lines.push(`${prefix}- ${stringValue}`)
      }
    }
  }

  /**
   * Stringify a simple value
   */
  private stringifyValue(value: YAMLValue): string {
    if (value === null) {
      return 'null'
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false'
    }

    if (typeof value === 'number') {
      return String(value)
    }

    if (typeof value === 'string') {
      return this.stringifyString(value)
    }

    // Fallback for objects/arrays (shouldn't reach here in normal use)
    return String(value)
  }

  /**
   * Stringify a string value, adding quotes if necessary
   */
  private stringifyString(str: string): string {
    // Check if quoting is needed
    if (this.needsQuotes(str)) {
      return this.quoteString(str)
    }
    return str
  }

  /**
   * Check if a string needs to be quoted
   */
  private needsQuotes(str: string): boolean {
    if (str === '') {
      return true
    }

    // Check for special patterns
    if (NEEDS_QUOTES.test(str)) {
      return true
    }

    // Check for special characters
    if (SPECIAL_CHARS.test(str)) {
      return true
    }

    // Check for newlines
    if (str.includes('\n')) {
      return true
    }

    return false
  }

  /**
   * Quote a string for YAML
   */
  private quoteString(str: string): string {
    // Use double quotes and escape special characters
    const escaped = str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')

    return `"${escaped}"`
  }
}

/**
 * Singleton instance for convenience
 */
export const yamlStringifier = new YAMLStringifier()
