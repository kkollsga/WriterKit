# WriterKit - Project Todo & Design Document

This document captures all findings from the planning stage, including purpose, design decisions, and implementation roadmap.

---

## Table of Contents

1. [Project Purpose](#1-project-purpose)
2. [Problem Statement](#2-problem-statement)
3. [Design Goals](#3-design-goals)
4. [TipTap Patterns to Preserve](#4-tiptap-patterns-to-preserve)
5. [Architecture](#5-architecture)
6. [Package Details](#6-package-details)
7. [Key Types & Interfaces](#7-key-types--interfaces)
8. [Page Calculation Strategy](#8-page-calculation-strategy)
9. [Markdown-Native Storage](#9-markdown-native-storage)
10. [Export Pipeline](#10-export-pipeline)
11. [Extension System](#11-extension-system)
12. [Testing Strategy](#12-testing-strategy)
13. [Implementation Phases](#13-implementation-phases)
14. [Current Progress](#14-current-progress)
15. [Remaining Tasks](#15-remaining-tasks)

---

## 1. Project Purpose

**WriterKit** is a ProseMirror-based toolkit for building word processors with:

- **Native pagination support** - Pages computed from content flow, not CSS hacks
- **Markdown as source of truth** - YAML frontmatter for metadata, portable format
- **Searchable PDF export** - Real text using pdf-lib, not html2canvas screenshots
- **DOCX and ODT export** - Native document formats
- **High performance** - Incremental reflow, virtual pagination, measurement caching
- **TipTap-inspired API** - Familiar extension system for developers

### Why Build This?

The WordProcessor project revealed fundamental limitations in existing solutions:

1. **TipTap/ProseMirror don't have native page concepts** - Pages are bolted on as visual overlays
2. **Export is fragmented** - Each format parsed/rendered separately, inconsistent results
3. **PDF exports are pixel-based** - html2canvas produces non-searchable, large files
4. **Markdown parsing is fragile** - Regex-based, breaks on nested formatting
5. **State management is unclear** - Multiple overlapping flags (isDirty, syncStatus)

WriterKit solves these by making pages a first-class citizen computed from content flow.

---

## 2. Problem Statement

### 2.1 Pagination Issues (from WordProcessor Analysis)

| Problem | Current Workaround | Impact |
|---------|-------------------|--------|
| No native page concept | `PageSpacer` uses CSS margin hacks | Fragile, 70% threshold is arbitrary |
| Visual pages ≠ document model | Margin adjustments at runtime | PDF export doesn't match visual |
| UI hardcoded to A4 | Ignores metadata settings | Can't change page size |
| Tables split mid-row | No table-aware pagination | Broken layouts |
| No headers/footers | Not implemented | Missing feature |
| Performance overhead | ResizeObserver + debounce on every update | Sluggish on large docs |

**Key files analyzed:**
- `WordProcessor-kopi/src/lib/tiptap/pageSpacer.ts` - CSS margin hack with 70% threshold
- `WordProcessor-kopi/src/lib/tiptap/pageBreak.ts` - Page break as content node

### 2.2 Export Issues

| Problem | Current Implementation | Impact |
|---------|----------------------|--------|
| PDF uses screenshots | `html2canvas` → pixels | Not searchable, large files |
| PDF ignores page boundaries | Slices canvas arbitrarily | Doesn't match visual |
| DOCX incomplete | Highlights skipped, list bug | Loss of formatting |
| Markdown parser fragile | Regex token replacement | Nested formatting breaks |
| No ODT support | Not implemented | Missing feature |

**Key files analyzed:**
- `WordProcessor-kopi/src/features/document/services/pdfExportService.ts` - html2canvas approach
- `WordProcessor-kopi/src/features/document/services/docxExportService.ts` - docx library with bugs

### 2.3 Architecture Issues

| Problem | Current State | Impact |
|---------|--------------|--------|
| Metadata fragmented | 4+ places define/parse metadata | No single source of truth |
| State machine unclear | `isDirty` + `syncStatus` overlap | Race conditions |
| Table logic scattered | 3 files, ~600 lines | Hard to maintain |
| Toolbar duplicated | 1150+ lines duplicated | Code bloat |
| No unified AST | Each export parses separately | Inconsistent output |

---

## 3. Design Goals

### 3.1 Core Principles

1. **Pages as First-Class Citizens**
   - Pages are computed from content, not stored
   - Page boundaries tracked efficiently via `PageModel`
   - All operations are page-aware

2. **Markdown-Native**
   - Markdown is the single source of truth
   - YAML frontmatter for metadata
   - HTML comments for page breaks: `<!-- page-break -->`
   - Portable to other markdown tools

3. **Searchable Exports**
   - PDF with real text via `pdf-lib` (not screenshots)
   - DOCX with proper structure via `docx` library
   - ODT support via `simple-odf`
   - All exports respect page boundaries

4. **High Performance**
   - Incremental page reflow (only recompute affected pages)
   - Virtual pagination for large documents (100+ pages)
   - Measurement caching
   - Web worker exports

5. **Extensible**
   - TipTap-inspired plugin system
   - Custom export renderers per node type
   - Storage adapter pattern
   - Migration compatibility layer for existing TipTap projects

### 3.2 Non-Goals

- **Not a full word processor** - That's built on top of WriterKit
- **Not a collaborative editing solution** - Use Y.js, Liveblocks, etc.
- **Not a markdown editor** - It's a document editor with markdown storage

---

## 4. TipTap Patterns to Preserve

These patterns from TipTap made WordProcessor development smooth and **must be preserved**:

### 4.1 Unified Extension Model

```
Extendable (base class)
├── Node (for block/inline nodes)
├── Mark (for character marks)
└── Extension (for behaviors & plugins)
```

**Key patterns:**
- Static `create()` factory: `Node.create({...})`
- Configuration as methods: `addOptions()`, `addCommands()`, `addKeyboardShortcuts()`
- Composition via `addExtensions()`: Kits can include other extensions
- Priority system: Extensions have `priority` (default 100) for ordering

### 4.2 Command System

```typescript
// Chainable commands
editor.chain().toggleBold().focus().run()

// Checkable without execution
editor.can().setBold()  // Returns boolean

// Commands receive context
({ commands, tr, state, view, dispatch, chain, can }) => { ... }
```

**Must preserve:**
- Command chaining in single transaction
- `can()` pattern for checking without side effects
- Command context access
- Per-extension commands via `addCommands()`

### 4.3 Event-Driven Lifecycle

```typescript
onCreate({ editor })          // Editor created
onUpdate({ editor })          // Content changed
onTransaction({ editor, transaction })
onSelectionUpdate({ editor })
onFocus({ editor, event })
onBlur({ editor, event })
onDestroy()
```

### 4.4 Schema Generation from Extensions

Schema built declaratively from extensions at runtime:

```typescript
parseHTML() {
  return [
    { tag: 'strong' },
    { tag: 'b', getAttrs: node => ... },
  ]
}

renderHTML({ HTMLAttributes }) {
  return ['strong', HTMLAttributes, 0]
}
```

### 4.5 Storage Per Extension

```typescript
addStorage() {
  return { count: 0, lastUsed: null }
}

// Access via
this.storage.count
editor.storage.extensionName.count
```

### 4.6 Framework-Agnostic Core

```
@writerkit/core   → Pure TypeScript, no React/Vue
@writerkit/react  → React bindings (useEditor, EditorContent)
```

### 4.7 TypeScript Declaration Merging

Extensions augment types without modifying core:

```typescript
declare module '@writerkit/core' {
  interface Commands<ReturnType> {
    bold: {
      setBold: () => ReturnType
      toggleBold: () => ReturnType
    }
  }
}
```

### 4.8 Extension Resolution & Composition

```typescript
const StarterKit = Extension.create({
  addExtensions() {
    return [BulletList, OrderedList, ListItem.configure({ ... })]
  }
})
```

### 4.9 Input & Paste Rules

```typescript
addInputRules() {
  return [markInputRule({ find: /\*\*([^*]+)\*\*$/, type: this.type })]
}
```

### 4.10 Additional WriterKit-Specific Methods

- `addPagination()` - Page-aware behavior hooks
- `addMarkdownHandlers()` - Markdown parse/render
- `addExportRenderers()` - PDF/DOCX/ODT rendering per node

---

## 5. Architecture

### 5.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                            │
│              (Your Word Processor App)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    @writerkit/react                       │   │
│  │     WriterKitProvider, Editor, PageView, Toolbar          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────┬───────────┴───────────┬──────────────────┐   │
│  │               │                       │                  │   │
│  │  @writerkit/  │    @writerkit/        │   @writerkit/    │   │
│  │  pagination   │    export             │   storage        │   │
│  │               │                       │                  │   │
│  │  PageComputer │    PDFExporter        │   FileSystem     │   │
│  │  ReflowEngine │    DOCXExporter       │   IndexedDB      │   │
│  │  PageView     │    ODTExporter        │   Remote         │   │
│  │               │                       │                  │   │
│  └───────┬───────┴───────────┬───────────┴────────┬─────────┘   │
│          │                   │                    │              │
│  ┌───────┴───────────────────┴────────────────────┴─────────┐   │
│  │                     @writerkit/core                       │   │
│  │                                                           │   │
│  │  Editor, Document, Schema, Extensions, MarkdownManager    │   │
│  └───────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
├──────────────────────────────┼───────────────────────────────────┤
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐   │
│  │                      ProseMirror                          │   │
│  │         (prosemirror-model, -state, -view, etc.)          │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Markdown   │────▶│    mdast    │────▶│ ProseMirror │
│   (file)    │     │    (AST)    │     │   (editor)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
      ▲                    │                   │
      │                    │                   ▼
      │                    │            ┌─────────────┐
      │                    │            │ PageComputer│
      │                    │            └──────┬──────┘
      │                    │                   │
      │                    ▼                   ▼
      │             ┌─────────────┐     ┌─────────────┐
      │             │   Export    │     │  PageModel  │
      │             │  Pipeline   │◀────│  (computed) │
      │             └──────┬──────┘     └─────────────┘
      │                    │
      │         ┌──────────┼──────────┐
      │         ▼          ▼          ▼
      │    ┌────────┐ ┌────────┐ ┌────────┐
      │    │  PDF   │ │  DOCX  │ │  ODT   │
      │    └────────┘ └────────┘ └────────┘
      │
┌─────┴─────┐
│  Storage  │
│  Adapter  │
└───────────┘
```

---

## 6. Package Details

### 6.1 @writerkit/core (Phase 1)

**Status: ✅ COMPLETE - All core classes implemented**

Core editor functionality wrapping ProseMirror.

```
packages/core/src/
├── Extension.ts       ✅ Created - Base extension class
├── Node.ts            ✅ Created - Node extension class
├── Mark.ts            ✅ Created - Mark extension class
├── types.ts           ✅ Created - Core type definitions
├── index.ts           ✅ Created - Public exports
├── Editor.ts          ✅ Created - Main editor class with ProseMirror integration
├── CommandManager.ts  ✅ Created - chain() and can() patterns
└── ExtensionManager.ts ✅ Created - Extension resolution and flattening
```

**Key Classes to Implement:**

```typescript
class WriterKitEditor {
  // Lifecycle
  constructor(config: EditorConfig)
  destroy(): void

  // Document operations
  load(source: string | StoredDocument): Promise<void>
  save(): Promise<void>
  getMarkdown(): string
  getJSON(): JSONContent

  // Page operations
  getPageModel(): PageModel
  getPageForPosition(pos: number): number
  scrollToPage(pageNumber: number): void

  // Export
  export(format: 'pdf' | 'docx' | 'odt'): Promise<Blob>

  // Events
  on(event: 'update' | 'pagesChanged' | 'stateChanged', handler): void
}
```

### 6.2 @writerkit/pagination (Phase 2)

Page computation engine.

```
packages/pagination/src/
├── PageComputer.ts     ❌ TODO - Computes page boundaries
├── ReflowEngine.ts     ❌ TODO - Incremental reflow
├── PageView.ts         ❌ TODO - Virtual page rendering
├── Measurer.ts         ❌ TODO - Block measurement
├── types.ts            ❌ TODO - Pagination types
└── index.ts            ❌ TODO - Public exports
```

**Key Types:**

```typescript
interface PageModel {
  pages: PageBoundary[]
  dimensions: PageDimensions
  totalHeight: number
}

interface PageBoundary {
  pageNumber: number      // 1-indexed
  startPos: number        // ProseMirror position
  endPos: number
  contentHeight: number   // in points
  forcedBreak: boolean    // User-inserted page break
}

interface PageDimensions {
  width: number           // in points
  height: number
  contentWidth: number    // width - margins
  contentHeight: number   // height - margins - header - footer
  margins: Margins
}
```

### 6.3 @writerkit/markdown (Phase 1)

**Status: ✅ COMPLETE - All markdown classes implemented**

Markdown-native storage with bidirectional sync.

```
packages/markdown/src/
├── MarkdownManager.ts  ✅ Created - Bidirectional sync orchestrator
├── ASTConverter.ts     ✅ Created - mdast <-> ProseMirror conversion
├── Frontmatter.ts      ✅ Created - YAML metadata parsing/serialization
├── types.ts            ✅ Created - AST types and interfaces
└── index.ts            ✅ Created - Public exports
```

**Dependencies:**
- `gray-matter` - YAML frontmatter parsing
- `mdast-util-from-markdown` - Markdown → AST
- `mdast-util-to-markdown` - AST → Markdown
- `unified` - AST transformation pipeline

### 6.4 @writerkit/export (Phase 3)

Unified export pipeline.

```
packages/export/src/
├── ExportPipeline.ts   ❌ TODO - Orchestrator
├── PDFExporter.ts      ❌ TODO - pdf-lib based
├── DOCXExporter.ts     ❌ TODO - docx based
├── ODTExporter.ts      ❌ TODO - simple-odf based
├── renderers/          ❌ TODO - Node renderers per format
└── index.ts            ❌ TODO - Public exports
```

**Dependencies:**
- `pdf-lib` - PDF generation with real searchable text
- `@pdf-lib/fontkit` - Font embedding
- `docx` - DOCX generation

### 6.5 @writerkit/storage (Phase 1)

Storage abstraction layer.

```
packages/storage/src/
├── StorageAdapter.ts       ❌ TODO - Base interface
├── FileSystemAdapter.ts    ❌ TODO - Tauri/Node
├── IndexedDBAdapter.ts     ❌ TODO - Browser
├── StateManager.ts         ❌ TODO - Document state machine
└── index.ts                ❌ TODO - Public exports
```

**Key Types:**

```typescript
type DocumentState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'modified'; since: Date }
  | { status: 'saving' }
  | { status: 'saved'; at: Date }
  | { status: 'error'; error: Error }
```

### 6.6 @writerkit/extensions (Phase 4)

Built-in extensions for common needs.

```
packages/extensions/src/
├── tables/             ❌ TODO - Page-aware table splitting
├── images/             ❌ TODO - Image handling
├── lists/              ❌ TODO - List handling
├── headers-footers/    ❌ TODO - Page headers/footers
└── index.ts            ❌ TODO - Public exports
```

### 6.7 @writerkit/react (Phase 5)

React bindings.

```
packages/react/src/
├── WriterKitProvider.tsx   ❌ TODO - Context provider
├── Editor.tsx              ❌ TODO - Editor component
├── PageView.tsx            ❌ TODO - Page rendering
├── Toolbar.tsx             ❌ TODO - Toolbar components
├── hooks/
│   ├── useWriterKit.ts     ❌ TODO - Main hook
│   ├── usePageModel.ts     ❌ TODO - Page model hook
│   └── useDocumentState.ts ❌ TODO - State hook
└── index.ts                ❌ TODO - Public exports
```

---

## 7. Key Types & Interfaces

### 7.1 Document Metadata

```typescript
interface DocumentMetadata {
  title: string
  author?: string
  createdAt: string
  modifiedAt: string
  pageSize: 'a4' | 'letter' | 'legal' | 'a3' | 'a5'
  orientation: 'portrait' | 'landscape'
  margins: {
    top: number    // in points (1/72 inch)
    right: number
    bottom: number
    left: number
  }
  header?: HeaderFooterConfig
  footer?: HeaderFooterConfig
}

interface HeaderFooterConfig {
  left?: string
  center?: string
  right?: string
  showOnFirstPage?: boolean
}

// Template variables: {{pageNumber}}, {{totalPages}}, {{title}}, {{date}}
```

### 7.2 Export Types

```typescript
type ExportFormat = 'pdf' | 'docx' | 'odt' | 'markdown' | 'html'

interface ExportOptions {
  metadata: DocumentMetadata
  pageModel: PageModel
  includeHeadersFooters?: boolean
}

interface PDFExportOptions extends ExportOptions {
  embedFonts?: boolean
  pdfA?: '1b' | '2b' | '3b'
  compression?: 'none' | 'fast' | 'best'
  imageDpi?: number
}

interface ExportResult {
  blob: Blob
  mimeType: string
  extension: string
  stats: {
    pageCount: number
    fileSize: number
    exportTimeMs: number
  }
}
```

---

## 8. Page Calculation Strategy

### 8.1 Core Algorithm

```
1. MEASURE all top-level blocks
   - Read DOM heights for visible blocks
   - Estimate heights for off-screen blocks (virtual scrolling)
   - Cache measurements until content changes

2. FIND hard page breaks (user-inserted <!-- page-break -->)

3. COMPUTE boundaries:
   For each block:
     - If hard break: start new page
     - If fits on current page: add to page
     - If doesn't fit:
       - If splittable (table) and worth splitting: split block
       - Else: move entire block to next page
       - Apply orphan/widow control

4. DIFF with previous model to find changed pages

5. UPDATE only changed page views (incremental)
```

### 8.2 Incremental Reflow

Only recompute from the point of change forward:

```typescript
class ReflowEngine {
  requestReflow(changedRegions: Range[]): void {
    clearTimeout(this.pendingReflow)
    this.pendingReflow = setTimeout(() => {
      this.performReflow(changedRegions)
    }, this.config.debounceMs)
  }

  partialReflow(fromPage: number): void {
    // Keep pages before change point
    // Recompute from change point forward
    // This is O(n) where n = pages after change, not total pages
  }
}
```

### 8.3 Table Splitting

Split tables at row boundaries, preserving header row:

```typescript
function splitTable(table: Node, availableHeight: number): SplitResult {
  // Always keep header row on both parts
  const headerRow = getHeaderRow(table)
  const headerHeight = measureRow(headerRow)

  // Find split point
  // Return { kept, overflow }
}
```

### 8.4 Virtual Pagination

For large documents (100+ pages):

```typescript
class VirtualPageView {
  private visibleRange = { start: 0, end: 3 }
  private buffer = 2  // Render 2 pages above/below viewport

  updateVisiblePages(scrollTop: number, viewportHeight: number): void {
    // Calculate visible range
    // Fully render pages in visible range
    // Use height placeholders for other pages
  }
}
```

---

## 9. Markdown-Native Storage

### 9.1 Document Format

```markdown
---
title: My Document
author: John Doe
createdAt: 2025-02-05T10:00:00Z
modifiedAt: 2025-02-05T14:30:00Z
pageSize: a4
orientation: portrait
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
header:
  center: "{{title}}"
footer:
  center: "Page {{pageNumber}} of {{totalPages}}"
---

# Introduction

This is the first paragraph.

<!-- page-break -->

# Chapter 2

Content continues on the next page.
```

### 9.2 Page Break Syntax

Using HTML comments for maximum compatibility:

```markdown
<!-- page-break -->
```

**Why HTML comments?**
- Invisible in markdown viewers that don't support it
- Valid HTML - won't break anything
- Easy to parse: `/<!--\s*page-break\s*-->/gi`
- Standard convention (many tools support it)

### 9.3 Frontmatter Handling

```typescript
class Frontmatter {
  private defaults: DocumentMetadata = {
    title: 'Untitled',
    pageSize: 'a4',
    orientation: 'portrait',
    margins: { top: 72, right: 72, bottom: 72, left: 72 }
  }

  parse(content: string): { metadata: DocumentMetadata; body: string }
  serialize(metadata: DocumentMetadata, body: string): string
}
```

---

## 10. Export Pipeline

### 10.1 Architecture

All exports go through a single AST (mdast) for consistency:

```
ProseMirror Doc → mdast AST → [PDF | DOCX | ODT]
```

### 10.2 PDF Export (Searchable Text)

Using `pdf-lib` instead of `html2canvas`:

```typescript
class PDFExporter {
  async export(ast: AST, options: PDFExportOptions): Promise<ExportResult> {
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)

    for (const boundary of options.pageModel.pages) {
      const page = this.createPage(doc, options.metadata)

      // Render header
      // Render content nodes with page.drawText() - REAL searchable text
      // Render footer
    }

    return { blob: new Blob([await doc.save()]) }
  }
}
```

### 10.3 DOCX Export

Improvements over WordProcessor implementation:

- Fix highlights (currently skipped)
- Fix list handling (bullet vs numbered)
- Respect page breaks as section breaks

### 10.4 ODT Export

New implementation using `simple-odf`:

```typescript
class ODTExporter {
  async export(ast: AST, options: ExportOptions): Promise<ExportResult> {
    const doc = new TextDocument()
    this.setPageLayout(doc, options.metadata)

    for (const node of ast.children) {
      if (node.type === 'pageBreak') {
        doc.addParagraph().setPageBreakBefore()
      } else {
        this.renderNode(doc, node)
      }
    }
  }
}
```

---

## 11. Extension System

### 11.1 Extension Interface

```typescript
interface WriterKitExtension {
  name: string
  priority?: number

  // ProseMirror schema additions
  nodes?: Record<string, NodeSpec>
  marks?: Record<string, MarkSpec>
  plugins?: (schema: Schema) => Plugin[]

  // Markdown handling
  markdown?: {
    parse?: (token: Token) => JSONContent | null
    render?: (node: JSONContent) => string
  }

  // Export renderers
  export?: {
    pdf?: ExportNodeRenderer
    docx?: ExportNodeRenderer
    odt?: ExportNodeRenderer
  }

  // Pagination hooks
  pagination?: {
    isSplittable?: (node: Node) => boolean
    getMinHeight?: (node: Node) => number
    split?: (node: Node, availableHeight: number) => SplitResult
  }
}
```

### 11.2 Example: Tables Extension

```typescript
const TablesExtension: WriterKitExtension = {
  name: 'tables',

  pagination: {
    isSplittable: () => true,
    split(table, availableHeight) {
      // Split at row boundaries
      // Keep header row on both parts
    }
  },

  export: {
    pdf: {
      async renderPDF(node, context) {
        // Draw table with borders, cell padding
      }
    },
    docx: {
      renderDOCX(node, context) {
        // Return docx Table object
      }
    }
  }
}
```

---

## 12. Testing Strategy

### 12.1 Test Pyramid

```
        ╱╲
       ╱  ╲     E2E Tests (few, slow, high confidence)
      ╱────╲
     ╱      ╲   Integration Tests (medium, focused)
    ╱────────╲
   ╱          ╲ Unit Tests (many, fast, isolated)
  ╱────────────╲
```

### 12.2 Test Categories

**Unit Tests:**
- Extension resolution and flattening
- Command system (chaining, can())
- Page boundary calculation
- AST conversion roundtrip
- Frontmatter parsing

**Integration Tests:**
- Incremental reflow
- Export pipeline
- Document state machine

**Visual Regression Tests:**
- PDF page layout snapshots
- Page view rendering (A4, letter, with margins)

**Performance Tests:**
- Page computation benchmarks (100 pages < 100ms)
- Incremental reflow (single paragraph < 16ms)
- PDF export (50 pages < 2s)

**E2E Tests (Playwright):**
- Load document and show pages
- Typing triggers reflow
- Export produces valid PDF

### 12.3 Test Fixtures

```
packages/test-fixtures/
├── documents/
│   ├── simple-paragraph.md
│   ├── all-formatting.md
│   ├── complex-table.md
│   ├── multi-page.md
│   ├── page-breaks.md
│   └── headers-footers.md
├── baselines/
│   ├── pdf/
│   ├── docx/
│   └── odt/
└── index.ts
```

### 12.4 Test Commands

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:visual": "vitest run --project visual",
    "test:e2e": "playwright test",
    "test:bench": "vitest bench",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 12.5 CI Workflow

```yaml
jobs:
  unit: pnpm test:unit
  integration: pnpm test:integration
  visual: pnpm test:visual (upload diff artifacts on failure)
  e2e: pnpm test:e2e (upload playwright report on failure)
  benchmark: pnpm test:bench
```

---

## 13. Implementation Phases

### Phase 1: Core Foundation ✅ COMPLETE

- [x] Set up monorepo structure (pnpm workspaces, turbo)
- [x] Create package.json for all packages
- [x] Create tsconfig.json and tsup.config.ts
- [x] Implement Extension, Node, Mark base classes
- [x] Define core TypeScript types
- [x] Implement Editor class with ProseMirror integration
- [x] Implement CommandManager (chain/can patterns)
- [x] Implement ExtensionManager (resolution, flattening, priority)
- [x] Implement @writerkit/markdown with AST conversion
- [x] Unit tests for AST conversion (92 tests passing)

**Deliverable:** Editor that loads/saves markdown, no pagination yet

### Phase 2: Pagination Engine ✅ COMPLETE

- [x] PageComputer with block measurement
- [x] ReflowEngine with incremental reflow
- [x] PageView for visual page rendering
- [x] Page break detection (`<!-- page-break -->`)
- [x] Integration tests for pagination (62 tests)

**Deliverable:** Working pagination with visual pages

### Phase 3: Export Pipeline

- [ ] PDFExporter with pdf-lib (searchable text)
- [ ] DOCXExporter improvements (highlights, lists)
- [ ] ODTExporter basic implementation
- [ ] Export tests with visual comparison

**Deliverable:** All three export formats working

### Phase 4: Extensions & Polish

- [ ] Tables extension with page-aware splitting
- [ ] Headers/footers extension
- [ ] Images extension
- [ ] Virtual pagination for large documents
- [ ] Performance optimization

**Deliverable:** Feature-complete library

### Phase 5: React Integration

- [ ] @writerkit/react package
- [ ] WriterKitProvider, Editor, PageView components
- [ ] Hooks: useWriterKit, usePageModel, useDocumentState
- [ ] Toolbar components

**Deliverable:** React bindings ready for use

### Phase 6: Migration & Documentation

- [ ] @writerkit/compat TipTap adapter
- [ ] Migration guide
- [ ] API documentation
- [ ] Example applications

**Deliverable:** Production-ready release

---

## 14. Current Progress

### Completed ✅

1. **Project renamed** from "ProsePage" to "WriterKit"
2. **Monorepo structure** created at `/writerkit/`
3. **All packages scaffolded** with package.json, tsconfig.json, tsup.config.ts
4. **@writerkit/core** COMPLETE:
   - `Extension.create()` - Behavior extensions
   - `Node.create()` - Node-type extensions
   - `Mark.create()` - Mark-type extensions
   - `Editor` - Main editor class with ProseMirror view/state
   - `CommandManager` - chain() and can() command patterns
   - `ExtensionManager` - Extension resolution, flattening, priority sorting
   - Full TypeScript type definitions
5. **@writerkit/markdown** COMPLETE:
   - `MarkdownManager` - Bidirectional sync orchestrator
   - `ASTConverter` - mdast ↔ ProseMirror conversion
   - `Frontmatter` - YAML metadata parsing/serialization
   - Page break handling via HTML comments
6. **Build system** working - both core and markdown packages build successfully
7. **Dependencies** installed via pnpm

### Package Build Status

| Package | Status |
|---------|--------|
| @writerkit/core | ✅ Complete & Builds |
| @writerkit/markdown | ✅ Complete & Builds (with 92 unit tests) |
| @writerkit/pagination | ✅ Complete & Builds (with 62 unit tests) |
| @writerkit/export | ⏳ Skeleton (builds) |
| @writerkit/storage | ⏳ Skeleton (builds) |
| @writerkit/react | ⏳ Skeleton (builds) |
| @writerkit/extensions | ⏳ Skeleton (builds) |
| @writerkit/test-fixtures | ✅ Complete & Builds |
| @writerkit/test-utils | ✅ Complete & Builds |

---

## 15. Remaining Tasks

### Immediate (Phase 1 completion) ✅ DONE

- [x] **Editor.ts** - Main editor class with ProseMirror integration ✅
- [x] **CommandManager.ts** - chain() and can() implementation ✅
- [x] **ExtensionManager.ts** - Extension resolution, flattening, priority sorting ✅
- [x] **@writerkit/markdown** - Full mdast integration ✅
  - [x] MarkdownManager.ts ✅
  - [x] ASTConverter.ts (mdast <-> ProseMirror) ✅
  - [x] Frontmatter.ts ✅
  - [x] types.ts ✅
- [x] **Unit tests** for AST roundtrip ✅ (92 tests across 3 test files)

### Next Priority (Phase 2)

- [ ] PageComputer implementation
- [ ] ReflowEngine with debouncing
- [ ] Block measurement caching
- [ ] PageView virtual rendering

### Performance Targets

| Operation | Target |
|-----------|--------|
| Initial page computation (100 pages) | < 100ms |
| Incremental reflow (single paragraph) | < 16ms |
| PDF export (50 pages) | < 2s |
| DOCX export (50 pages) | < 1s |
| Markdown parse (10KB) | < 10ms |
| Save operation | < 50ms |

---

## Dependencies Reference

### Production

| Package | Purpose |
|---------|---------|
| prosemirror-* | Core editor |
| pdf-lib | PDF generation with real text |
| @pdf-lib/fontkit | Font embedding |
| docx | DOCX generation |
| simple-odf | ODT generation |
| unified/remark | Markdown AST |
| gray-matter | YAML frontmatter |

### Development

| Package | Purpose |
|---------|---------|
| vitest | Testing |
| tsup | Building |
| turbo | Monorepo orchestration |
| typescript | Type safety |
| playwright | E2E testing |

---

## References

- [ProseMirror Guide](https://prosemirror.net/docs/guide/)
- [mdast Specification](https://github.com/syntax-tree/mdast)
- [pdf-lib Documentation](https://pdf-lib.js.org/)
- [docx Documentation](https://docx.js.org/)
- [TipTap Documentation](https://tiptap.dev/)
- [prosemirror-unified](https://github.com/marekdedic/prosemirror-unified)
- [remark-prosemirror](https://github.com/handlewithcarecollective/remark-prosemirror)
