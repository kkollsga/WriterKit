/**
 * # WriterKit
 *
 * A ProseMirror-based toolkit for building word processors with:
 *
 * - **Native pagination** - Pages computed from content flow, not CSS hacks
 * - **Searchable PDF export** - Real text using pdf-lib, not screenshots
 * - **DOCX and ODT export** - Native document formats
 * - **Markdown storage** - YAML frontmatter for metadata, portable format
 * - **Familiar extension system** - Easy to extend and customize
 *
 * ## Installation
 *
 * ```bash
 * npm install writerkit
 * # or
 * pnpm add writerkit
 * # or
 * yarn add writerkit
 * ```
 *
 * ## Quick Start
 *
 * ```typescript
 * import {
 *   Editor,
 *   Extension,
 *   MarkdownManager,
 *   ReflowEngine,
 *   ExportPipeline,
 * } from 'writerkit'
 *
 * // Create editor with extensions
 * const editor = new Editor({
 *   extensions: [
 *     // Add your extensions here
 *   ],
 * })
 *
 * // Load markdown document
 * const manager = new MarkdownManager()
 * const { metadata, doc } = manager.parse(markdownContent)
 *
 * // Set up pagination
 * const reflow = new ReflowEngine({
 *   pageSize: metadata.pageSize || 'a4',
 *   margins: metadata.margins,
 * })
 *
 * // Export to PDF
 * const pipeline = new ExportPipeline()
 * const result = await pipeline.exportPDF(editor.state.doc, {
 *   metadata: { title: metadata.title },
 *   paginationModel: reflow.getModel(),
 * })
 * ```
 *
 * ## Subpath Imports
 *
 * You can import from specific subpaths for better tree-shaking:
 *
 * ```typescript
 * import { Editor } from 'writerkit/core'
 * import { ReflowEngine } from 'writerkit/pagination'
 * import { ExportPipeline } from 'writerkit/export'
 * import { MarkdownManager } from 'writerkit/markdown'
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
  PageSize,
  PageOrientation,
  Margins,
  HeaderFooterConfig,
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
// Pagination - Page computation engine
// =============================================================================

export {
  PAGE_SIZES,
  DEFAULT_PAGINATION_CONFIG,
  createPageDimensions,
  configFromMetadata,
  Measurer,
  PageComputer,
  ReflowEngine,
  PageView,
  PageViewManager,
} from './pagination'

export type {
  PageDimensions,
  PageBoundary,
  NodePosition,
  PaginationModel,
  BlockMeasurement,
  PaginationConfig,
  PaginationEvents,
  SplitResult,
  PosRange,
  ReflowChange,
  PageViewOptions,
} from './pagination'

// =============================================================================
// Export - PDF, DOCX, ODT exporters
// =============================================================================

export {
  ExportPipeline,
  createExportPipeline,
  PDFExporter,
  DOCXExporter,
  ODTExporter,
  DEFAULT_FONTS,
  parsePageRange,
  replaceTemplateVariables,
} from './export'

export type {
  ExportFormat,
  ExportOptions,
  PDFExportOptions,
  DOCXExportOptions,
  ODTExportOptions,
  ExportResult,
  ExportStats,
  ExportPipelineConfig,
  FormatOptions,
  FontConfig,
  RenderContext,
  NodeRenderer,
  Exporter,
} from './export'

// =============================================================================
// Storage - Storage adapters
// =============================================================================

export {
  StorageAdapter,
  FileSystemAdapter,
  IndexedDBAdapter,
  MemoryAdapter,
  DocumentStateManager,
} from './storage'

export type {
  StorageAdapterConfig,
  StoredDocument,
  DocumentState,
  DocumentStateEvents,
} from './storage'

// =============================================================================
// Extensions - Built-in extensions
// =============================================================================

export {
  TableExtension,
  ImageExtension,
  HeaderFooterExtension,
  ListsExtension,
  WriterKitExtensions,
} from './extensions'

export type {
  TableOptions,
  ImageOptions,
  HeaderFooterOptions,
} from './extensions'

// =============================================================================
// React - React components and hooks
// =============================================================================

export {
  WriterKitContext,
  WriterKitProvider,
  Editor as ReactEditor,
  PageView as ReactPageView,
  useWriterKit,
  usePageBoundary,
  useDocumentState,
} from './react'

export type {
  WriterKitContextValue,
  WriterKitProviderProps,
  EditorProps,
  PageViewProps as ReactPageViewProps,
} from './react'
