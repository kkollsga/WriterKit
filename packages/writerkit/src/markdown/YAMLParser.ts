/**
 * YAMLParser - Simple YAML parser for frontmatter
 *
 * A lightweight YAML parser that handles the subset of YAML features
 * used in document frontmatter. Does not depend on Node.js APIs.
 *
 * Supported features:
 * - Key-value pairs
 * - Strings (quoted and unquoted)
 * - Numbers
 * - Booleans (true/false)
 * - Nested objects (via indentation)
 * - Comments (lines starting with #)
 */

export type YAMLValue =
  | string
  | number
  | boolean
  | null
  | YAMLObject
  | YAMLArray

export interface YAMLObject {
  [key: string]: YAMLValue
}

export type YAMLArray = YAMLValue[]

/**
 * Parse result from extracting frontmatter
 */
export interface FrontmatterResult {
  data: YAMLObject
  content: string
}

/**
 * Simple YAML parser for frontmatter
 *
 * @example
 * ```typescript
 * const parser = new YAMLParser()
 * const { data, content } = parser.extractFrontmatter(markdown)
 * console.log(data.title) // 'My Document'
 * ```
 */
export class YAMLParser {
  /**
   * Extract frontmatter from markdown content
   *
   * @param input - Full markdown content with optional frontmatter
   * @returns Parsed data object and remaining content
   */
  extractFrontmatter(input: string): FrontmatterResult {
    const trimmed = input.trimStart()

    // Check for frontmatter delimiter
    if (!trimmed.startsWith('---')) {
      return { data: {}, content: input }
    }

    // Find the closing delimiter
    const afterOpening = trimmed.slice(3)
    const closingIndex = afterOpening.indexOf('\n---')

    if (closingIndex === -1) {
      // No closing delimiter, treat entire content as body
      return { data: {}, content: input }
    }

    // Extract YAML content (between delimiters)
    const yamlContent = afterOpening.slice(0, closingIndex).trim()
    const bodyStart = closingIndex + 4 // +4 for '\n---'

    // Find where the body actually starts (skip newlines after closing ---)
    let bodyContent = afterOpening.slice(bodyStart)
    // Remove leading newline if present
    if (bodyContent.startsWith('\n')) {
      bodyContent = bodyContent.slice(1)
    }

    // Parse the YAML content
    const data = this.parse(yamlContent)

    return { data, content: bodyContent }
  }

  /**
   * Parse YAML string into an object
   *
   * @param yaml - YAML string to parse
   * @returns Parsed object
   */
  parse(yaml: string): YAMLObject {
    if (!yaml.trim()) {
      return {}
    }

    const lines = yaml.split('\n')
    return this.parseBlock(lines, 0, 0).value as YAMLObject
  }

  /**
   * Parse a block of YAML lines at a given indentation level
   */
  private parseBlock(
    lines: string[],
    startIndex: number,
    baseIndent: number
  ): { value: YAMLObject; endIndex: number } {
    const result: YAMLObject = {}
    let i = startIndex

    while (i < lines.length) {
      const line = lines[i]

      // Skip empty lines and comments
      if (this.isEmptyOrComment(line)) {
        i++
        continue
      }

      // Calculate indentation
      const indent = this.getIndent(line)

      // If we've de-indented, we're done with this block
      if (indent < baseIndent) {
        break
      }

      // Skip lines that are more indented than expected at the start
      if (i === startIndex && indent > baseIndent) {
        // This shouldn't happen for well-formed YAML, but handle it
        i++
        continue
      }

      // Parse the key-value pair
      const trimmedLine = line.trim()
      const colonIndex = trimmedLine.indexOf(':')

      if (colonIndex === -1) {
        // Invalid line, skip it
        i++
        continue
      }

      const key = trimmedLine.slice(0, colonIndex).trim()
      const valueStr = trimmedLine.slice(colonIndex + 1).trim()

      if (valueStr === '' || valueStr === '|' || valueStr === '>') {
        // Nested object or multiline string
        // Look ahead to see if next line is indented
        const nextLineIndex = this.findNextNonEmptyLine(lines, i + 1)

        if (nextLineIndex !== -1 && this.getIndent(lines[nextLineIndex]) > indent) {
          // It's a nested object
          const childIndent = this.getIndent(lines[nextLineIndex])
          const nested = this.parseBlock(lines, nextLineIndex, childIndent)
          result[key] = nested.value
          i = nested.endIndex
        } else {
          // Empty value
          result[key] = null
          i++
        }
      } else {
        // Simple value on the same line
        result[key] = this.parseValue(valueStr)
        i++
      }
    }

    return { value: result, endIndex: i }
  }

  /**
   * Parse a YAML value string
   */
  private parseValue(str: string): YAMLValue {
    // Handle quoted strings
    if ((str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1)
    }

    // Handle booleans
    const lower = str.toLowerCase()
    if (lower === 'true' || lower === 'yes' || lower === 'on') {
      return true
    }
    if (lower === 'false' || lower === 'no' || lower === 'off') {
      return false
    }

    // Handle null
    if (lower === 'null' || lower === '~' || str === '') {
      return null
    }

    // Handle numbers
    if (/^-?\d+$/.test(str)) {
      return parseInt(str, 10)
    }
    if (/^-?\d+\.\d+$/.test(str)) {
      return parseFloat(str)
    }

    // Default to string
    return str
  }

  /**
   * Check if a line is empty or a comment
   */
  private isEmptyOrComment(line: string): boolean {
    const trimmed = line.trim()
    return trimmed === '' || trimmed.startsWith('#')
  }

  /**
   * Get the indentation level of a line (number of leading spaces)
   */
  private getIndent(line: string): number {
    let count = 0
    for (const char of line) {
      if (char === ' ') {
        count++
      } else if (char === '\t') {
        count += 2 // Treat tab as 2 spaces
      } else {
        break
      }
    }
    return count
  }

  /**
   * Find the next non-empty, non-comment line
   */
  private findNextNonEmptyLine(lines: string[], startIndex: number): number {
    for (let i = startIndex; i < lines.length; i++) {
      if (!this.isEmptyOrComment(lines[i])) {
        return i
      }
    }
    return -1
  }
}

/**
 * Singleton instance for convenience
 */
export const yamlParser = new YAMLParser()
