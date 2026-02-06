import type { Schema, MarkSpec, NodeSpec } from 'prosemirror-model'
import type { EditorState, Plugin, Transaction } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

/**
 * Document metadata stored in YAML frontmatter
 */
export interface DocumentMetadata {
  title: string
  author?: string
  createdAt: string
  modifiedAt: string
  [key: string]: unknown // Allow additional metadata
}

/**
 * Editor configuration
 */
export interface EditorConfig {
  /** Initial content as markdown string */
  content?: string
  /** Extensions to load */
  extensions?: WriterKitExtension[]
  /** Element to mount the editor to */
  element?: HTMLElement
  /** Whether the editor is editable */
  editable?: boolean
  /** Callback when content changes */
  onUpdate?: (props: { editor: WriterKitEditor }) => void
  /** Callback when selection changes */
  onSelectionUpdate?: (props: { editor: WriterKitEditor }) => void
}

/**
 * Main editor interface
 */
export interface WriterKitEditor {
  /** The ProseMirror view */
  view: EditorView
  /** The ProseMirror state */
  state: EditorState
  /** The schema */
  schema: Schema
  /** Storage for extensions */
  storage: Record<string, unknown>

  // Lifecycle
  destroy(): void

  // Content operations
  getMarkdown(): string
  getJSON(): JSONContent
  getHTML(): string
  setContent(content: string | JSONContent): void

  // Commands
  chain(): ChainedCommands
  can(): CanCommands

  // Events
  on<E extends keyof EditorEvents>(event: E, handler: EditorEvents[E]): void
  off<E extends keyof EditorEvents>(event: E, handler: EditorEvents[E]): void
}

/**
 * JSON content representation (ProseMirror-compatible)
 */
export interface JSONContent {
  type: string
  attrs?: Record<string, unknown>
  content?: JSONContent[]
  marks?: Array<{
    type: string
    attrs?: Record<string, unknown>
  }>
  text?: string
}

/**
 * Editor events
 */
export interface EditorEvents {
  update: (props: { editor: WriterKitEditor; transaction: Transaction }) => void
  selectionUpdate: (props: { editor: WriterKitEditor }) => void
  create: (props: { editor: WriterKitEditor }) => void
  destroy: () => void
  focus: (props: { editor: WriterKitEditor; event: FocusEvent }) => void
  blur: (props: { editor: WriterKitEditor; event: FocusEvent }) => void
}

/**
 * Chainable commands interface
 */
export interface ChainedCommands {
  run(): boolean
  // Will be extended by extensions via declaration merging
}

/**
 * Can-check commands interface
 */
export interface CanCommands {
  // Will be extended by extensions via declaration merging
}

/**
 * Extension interface
 */
export interface WriterKitExtension<
  Options = Record<string, unknown>,
  Storage = Record<string, unknown>
> {
  name: string
  type: 'node' | 'mark' | 'extension'
  priority?: number
  options: Options
  storage: Storage

  // Schema
  addNodes?(): Record<string, NodeSpec>
  addMarks?(): Record<string, MarkSpec>

  // Plugins
  addPlugins?(): Plugin[]

  // Commands
  addCommands?(): Record<string, (...args: unknown[]) => CommandFunction>

  // Keyboard shortcuts
  addKeyboardShortcuts?(): Record<string, () => boolean>

  // Input rules (auto-conversion)
  addInputRules?(): InputRule[]

  // Paste rules
  addPasteRules?(): PasteRule[]

  // Lifecycle
  onCreate?(props: { editor: WriterKitEditor }): void
  onUpdate?(props: { editor: WriterKitEditor }): void
  onDestroy?(): void
  onSelectionUpdate?(props: { editor: WriterKitEditor }): void

  // Configuration
  configure?(options: Partial<Options>): WriterKitExtension<Options, Storage>
}

/**
 * Command function type
 */
export type CommandFunction = (props: CommandProps) => boolean

export interface CommandProps {
  editor: WriterKitEditor
  state: EditorState
  view: EditorView
  tr: Transaction
  dispatch: ((tr: Transaction) => void) | undefined
  chain: () => ChainedCommands
  can: () => CanCommands
}

/**
 * Input rule for auto-conversion
 */
export interface InputRule {
  find: RegExp
  handler: (props: {
    state: EditorState
    match: RegExpMatchArray
    range: { from: number; to: number }
  }) => Transaction | null
}

/**
 * Paste rule for pasted content conversion
 */
export interface PasteRule {
  find: RegExp
  handler: (props: {
    state: EditorState
    match: RegExpMatchArray
    range: { from: number; to: number }
  }) => Transaction | null
}

/**
 * Extension creation options
 */
export interface ExtensionCreateOptions<
  Options = Record<string, unknown>,
  Storage = Record<string, unknown>
> {
  name: string
  priority?: number

  addOptions?(): Options
  addStorage?(): Storage

  addNodes?(): Record<string, NodeSpec>
  addMarks?(): Record<string, MarkSpec>
  addPlugins?(): Plugin[]
  addCommands?(): Record<string, (...args: unknown[]) => CommandFunction>
  addKeyboardShortcuts?(): Record<string, () => boolean>
  addInputRules?(): InputRule[]
  addPasteRules?(): PasteRule[]

  onCreate?(this: WriterKitExtension<Options, Storage>, props: { editor: WriterKitEditor }): void
  onUpdate?(this: WriterKitExtension<Options, Storage>, props: { editor: WriterKitEditor }): void
  onDestroy?(this: WriterKitExtension<Options, Storage>): void
  onSelectionUpdate?(this: WriterKitExtension<Options, Storage>, props: { editor: WriterKitEditor }): void
}
