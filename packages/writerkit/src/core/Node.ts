import type {
  WriterKitExtension,
  CommandFunction,
  InputRule,
  PasteRule,
  WriterKitEditor,
} from './types'
import type { NodeSpec, MarkSpec, DOMOutputSpec } from 'prosemirror-model'

// ParseRule type that's compatible with ProseMirror
type ParseRule = {
  tag?: string
  namespace?: string
  style?: string
  priority?: number
  consuming?: boolean
  context?: string
  node?: string
  mark?: string
  ignore?: boolean
  skip?: boolean
  attrs?: Record<string, unknown> | ((node: Node | string) => Record<string, unknown> | false | null)
  getAttrs?: (node: Node | string) => Record<string, unknown> | false | null
  contentElement?: string | HTMLElement | ((node: Node) => HTMLElement)
  getContent?: (node: Node, schema: unknown) => unknown
  preserveWhitespace?: boolean | 'full'
}
import type { Plugin } from 'prosemirror-state'

/**
 * Default priority for nodes
 */
const DEFAULT_PRIORITY = 100

/**
 * Node creation options
 */
export interface NodeCreateOptions<
  Options extends Record<string, unknown> = Record<string, unknown>,
  Storage extends Record<string, unknown> = Record<string, unknown>
> {
  name: string
  priority?: number

  // Node spec
  group?: string
  content?: string
  inline?: boolean
  atom?: boolean
  selectable?: boolean
  draggable?: boolean
  code?: boolean
  defining?: boolean
  isolating?: boolean
  attrs?: Record<string, { default?: unknown }>

  // Parse/render
  parseHTML?: () => ParseRule[]
  renderHTML?: (props: { node: NodeWithAttrs; HTMLAttributes: Record<string, unknown> }) => DOMOutputSpec

  // Options and storage
  addOptions?(): Options
  addStorage?(): Storage

  // Additional schema
  addMarks?(): Record<string, MarkSpec>
  addPlugins?(): Plugin[]
  addCommands?(): Record<string, (...args: unknown[]) => CommandFunction>
  addKeyboardShortcuts?(): Record<string, () => boolean>
  addInputRules?(): InputRule[]
  addPasteRules?(): PasteRule[]

  // Lifecycle
  onCreate?(this: Node<Options, Storage>, props: { editor: WriterKitEditor }): void
  onUpdate?(this: Node<Options, Storage>, props: { editor: WriterKitEditor }): void
  onDestroy?(this: Node<Options, Storage>): void
  onSelectionUpdate?(this: Node<Options, Storage>, props: { editor: WriterKitEditor }): void
}

interface NodeWithAttrs {
  attrs: Record<string, unknown>
}

/**
 * Class for creating WriterKit node extensions
 */
export class Node<
  Options extends Record<string, unknown> = Record<string, unknown>,
  Storage extends Record<string, unknown> = Record<string, unknown>
> implements WriterKitExtension<Options, Storage> {
  name: string
  type: 'node' | 'mark' | 'extension' = 'node'
  priority: number
  options: Options
  storage: Storage

  private config: NodeCreateOptions<Options, Storage>

  protected constructor(config: NodeCreateOptions<Options, Storage>) {
    this.name = config.name
    this.priority = config.priority ?? DEFAULT_PRIORITY
    this.config = config
    this.options = config.addOptions?.() ?? ({} as Options)
    this.storage = config.addStorage?.() ?? ({} as Storage)
  }

  /**
   * Create a new node extension
   *
   * @example
   * ```typescript
   * const Paragraph = Node.create({
   *   name: 'paragraph',
   *   group: 'block',
   *   content: 'inline*',
   *   parseHTML() {
   *     return [{ tag: 'p' }]
   *   },
   *   renderHTML({ HTMLAttributes }) {
   *     return ['p', HTMLAttributes, 0]
   *   }
   * })
   * ```
   */
  static create<
    O extends Record<string, unknown> = Record<string, unknown>,
    S extends Record<string, unknown> = Record<string, unknown>
  >(config: NodeCreateOptions<O, S>): Node<O, S> {
    return new Node<O, S>(config)
  }

  /**
   * Configure the node with new options
   */
  configure(options: Partial<Options>): Node<Options, Storage> {
    const newNode = new Node<Options, Storage>(this.config)
    newNode.options = { ...this.options, ...options }
    return newNode
  }

  /**
   * Build the NodeSpec for ProseMirror schema
   */
  addNodes(): Record<string, NodeSpec> {
    const spec: NodeSpec = {
      group: this.config.group,
      content: this.config.content,
      inline: this.config.inline,
      atom: this.config.atom,
      selectable: this.config.selectable,
      draggable: this.config.draggable,
      code: this.config.code,
      defining: this.config.defining,
      isolating: this.config.isolating,
      attrs: this.config.attrs,
    }

    if (this.config.parseHTML) {
      spec.parseDOM = this.config.parseHTML() as NodeSpec['parseDOM']
    }

    if (this.config.renderHTML) {
      spec.toDOM = (node) => this.config.renderHTML!({
        node: node as unknown as NodeWithAttrs,
        HTMLAttributes: node.attrs,
      })
    }

    // Remove undefined values
    Object.keys(spec).forEach((key) => {
      if (spec[key as keyof NodeSpec] === undefined) {
        delete spec[key as keyof NodeSpec]
      }
    })

    return { [this.name]: spec }
  }

  addMarks(): Record<string, MarkSpec> {
    return this.config.addMarks?.() ?? {}
  }

  addPlugins(): Plugin[] {
    return this.config.addPlugins?.call(this) ?? []
  }

  addCommands(): Record<string, (...args: unknown[]) => CommandFunction> {
    return this.config.addCommands?.call(this) ?? {}
  }

  addKeyboardShortcuts(): Record<string, () => boolean> {
    return this.config.addKeyboardShortcuts?.call(this) ?? {}
  }

  addInputRules(): InputRule[] {
    return this.config.addInputRules?.call(this) ?? []
  }

  addPasteRules(): PasteRule[] {
    return this.config.addPasteRules?.call(this) ?? []
  }

  onCreate(props: { editor: WriterKitEditor }): void {
    this.config.onCreate?.call(this, props)
  }

  onUpdate(props: { editor: WriterKitEditor }): void {
    this.config.onUpdate?.call(this, props)
  }

  onDestroy(): void {
    this.config.onDestroy?.call(this)
  }

  onSelectionUpdate(props: { editor: WriterKitEditor }): void {
    this.config.onSelectionUpdate?.call(this, props)
  }
}
