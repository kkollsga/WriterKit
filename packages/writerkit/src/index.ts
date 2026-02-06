/**
 * # WriterKit
 *
 * A minimal ProseMirror-based rich text editor with:
 *
 * - **Core editor** - ProseMirror wrapper with extension system
 * - **Markdown support** - Parse and serialize markdown with frontmatter
 * - **Rich content** - Tables, lists, headings, formatting, and more
 *
 * ## Installation
 *
 * ```bash
 * npm install writerkit
 * ```
 *
 * ## Quick Start
 *
 * ```typescript
 * import { Editor, WriterKitExtensions, MarkdownManager } from 'writerkit'
 *
 * // Create editor with extensions
 * const editor = new Editor({
 *   element: document.getElementById('editor'),
 *   extensions: WriterKitExtensions,
 *   content: '# Hello World',
 * })
 *
 * // Get content as markdown
 * const markdown = editor.getMarkdown()
 * ```
 *
 * ## Subpath Imports
 *
 * ```typescript
 * import { Editor } from 'writerkit/core'
 * import { MarkdownManager } from 'writerkit/markdown'
 * import { WriterKitExtensions } from 'writerkit/extensions'
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Core - Editor, extensions, commands
// =============================================================================

export {
  Editor,
  Extension,
  Node,
  Mark,
  CommandManager,
  ExtensionManager,
} from './core'

export type {
  EditorConfig,
  EditorEvents,
  ChainedCommands,
  CanCommands,
  WriterKitExtension,
  ExtensionCreateOptions,
  CommandFunction,
  CommandProps,
  InputRule,
  PasteRule,
  DocumentMetadata,
  JSONContent,
} from './core'

// =============================================================================
// Markdown - Parsing and serialization
// =============================================================================

export {
  MarkdownManager,
  ASTConverter,
  Frontmatter,
} from './markdown'

export type {
  ParseResult,
  SerializeResult,
  ParseOptions,
  SerializeOptions,
  NodeMapping,
  MarkMapping,
  ConverterConfig,
  WriterKitRoot,
  WriterKitContent,
  PageBreakNode,
} from './markdown'

// =============================================================================
// Extensions - Built-in extensions
// =============================================================================

export {
  // Individual extensions
  HeadingExtension,
  BlockquoteExtension,
  CodeBlockExtension,
  HorizontalRuleExtension,
  HardBreakExtension,
  BoldExtension,
  ItalicExtension,
  CodeExtension,
  LinkExtension,
  TableExtension,
  ListsExtension,
  // Bundles
  BasicTextExtensions,
  WriterKitExtensions,
  // Legacy aliases
  Tables,
  Lists,
  Heading,
  Blockquote,
  CodeBlock,
  HorizontalRule,
  HardBreak,
  Bold,
  Italic,
  Code,
  Link,
} from './extensions'

export type {
  TableOptions,
  ListOptions,
} from './extensions'

// =============================================================================
// React - React components and hooks
// =============================================================================

export {
  WriterKitContext,
  WriterKitProvider,
  Editor as ReactEditor,
  useWriterKit,
  useDocumentState,
  useEditorFocus,
} from './react'

export type {
  WriterKitContextValue,
  WriterKitProviderProps,
  EditorProps,
  WriterKitConfig,
} from './react'
