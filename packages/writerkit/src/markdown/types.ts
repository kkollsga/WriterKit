import type { DocumentMetadata, JSONContent } from '../core'
import type { Root, Content, PhrasingContent } from 'mdast'

/**
 * Extended mdast Root with WriterKit-specific nodes
 */
export interface WriterKitRoot extends Omit<Root, 'children'> {
  type: 'root'
  children: WriterKitContent[]
}

/**
 * Union of all content types including WriterKit-specific nodes
 */
export type WriterKitContent = Content | PageBreakNode

/**
 * Page break node in the AST
 * Represents `<!-- page-break -->` in markdown
 */
export interface PageBreakNode {
  type: 'pageBreak'
}

/**
 * Result of parsing a markdown document
 */
export interface ParseResult {
  /** The parsed AST */
  ast: WriterKitRoot
  /** Document metadata from YAML frontmatter */
  metadata: DocumentMetadata
  /** The raw body content (without frontmatter) */
  body: string
}

/**
 * Result of serializing a document to markdown
 */
export interface SerializeResult {
  /** The complete markdown string with frontmatter */
  markdown: string
  /** Just the YAML frontmatter */
  frontmatter: string
  /** Just the body content */
  body: string
}

/**
 * Options for markdown parsing
 */
export interface ParseOptions {
  /** Whether to strip frontmatter (default: false) */
  stripFrontmatter?: boolean
  /** Whether to convert page breaks (default: true) */
  convertPageBreaks?: boolean
}

/**
 * Options for markdown serialization
 */
export interface SerializeOptions {
  /** Whether to include frontmatter (default: true) */
  includeFrontmatter?: boolean
  /** Whether to use minimal frontmatter (only non-default values) */
  minimalFrontmatter?: boolean
}

/**
 * Mapping between mdast node types and ProseMirror node types
 */
export interface NodeMapping {
  /** mdast type */
  mdast: string
  /** ProseMirror type */
  prosemirror: string
  /** Transform mdast node to ProseMirror JSON */
  toProseMirror?: (node: Content) => JSONContent
  /** Transform ProseMirror JSON to mdast node */
  toMdast?: (node: JSONContent) => Content
}

/**
 * Mapping between mdast mark types and ProseMirror mark types
 */
export interface MarkMapping {
  /** mdast type */
  mdast: string
  /** ProseMirror type */
  prosemirror: string
  /** Extract mark from mdast node */
  extractMark?: (node: PhrasingContent) => { type: string; attrs?: Record<string, unknown> }
}

/**
 * Configuration for the ASTConverter
 */
export interface ConverterConfig {
  /** Custom node mappings */
  nodeMappings?: NodeMapping[]
  /** Custom mark mappings */
  markMappings?: MarkMapping[]
  /** Whether to preserve unknown nodes (default: false) */
  preserveUnknown?: boolean
}
