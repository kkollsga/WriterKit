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
 * Default priority for marks
 */
const DEFAULT_PRIORITY = 100

/**
 * Mark creation options
 */
export interface MarkCreateOptions<
  Options extends Record<string, unknown> = Record<string, unknown>,
  Storage extends Record<string, unknown> = Record<string, unknown>
> {
  name: string
  priority?: number

  // Mark spec
  inclusive?: boolean
  excludes?: string
  group?: string
  spanning?: boolean
  attrs?: Record<string, { default?: unknown }>

  // Parse/render
  parseHTML?: () => ParseRule[]
  renderHTML?: (props: { mark: MarkWithAttrs; HTMLAttributes: Record<string, unknown> }) => DOMOutputSpec

  // Options and storage
  addOptions?(): Options
  addStorage?(): Storage

  // Additional
  addPlugins?(): Plugin[]
  addCommands?(): Record<string, (...args: unknown[]) => CommandFunction>
  addKeyboardShortcuts?(): Record<string, () => boolean>
  addInputRules?(): InputRule[]
  addPasteRules?(): PasteRule[]

  // Lifecycle
  onCreate?(this: Mark<Options, Storage>, props: { editor: WriterKitEditor }): void
  onUpdate?(this: Mark<Options, Storage>, props: { editor: WriterKitEditor }): void
  onDestroy?(this: Mark<Options, Storage>): void
  onSelectionUpdate?(this: Mark<Options, Storage>, props: { editor: WriterKitEditor }): void
}

interface MarkWithAttrs {
  attrs: Record<string, unknown>
}

/**
 * Class for creating WriterKit mark extensions
 */
export class Mark<
  Options extends Record<string, unknown> = Record<string, unknown>,
  Storage extends Record<string, unknown> = Record<string, unknown>
> implements WriterKitExtension<Options, Storage> {
  name: string
  type: 'node' | 'mark' | 'extension' = 'mark'
  priority: number
  options: Options
  storage: Storage

  private config: MarkCreateOptions<Options, Storage>

  protected constructor(config: MarkCreateOptions<Options, Storage>) {
    this.name = config.name
    this.priority = config.priority ?? DEFAULT_PRIORITY
    this.config = config
    this.options = config.addOptions?.() ?? ({} as Options)
    this.storage = config.addStorage?.() ?? ({} as Storage)
  }

  /**
   * Create a new mark extension
   *
   * @example
   * ```typescript
   * const Bold = Mark.create({
   *   name: 'bold',
   *   parseHTML() {
   *     return [
   *       { tag: 'strong' },
   *       { tag: 'b' },
   *       { style: 'font-weight=bold' }
   *     ]
   *   },
   *   renderHTML({ HTMLAttributes }) {
   *     return ['strong', HTMLAttributes, 0]
   *   }
   * })
   * ```
   */
  static create<
    O extends Record<string, unknown> = Record<string, unknown>,
    S extends Record<string, unknown> = Record<string, unknown>
  >(config: MarkCreateOptions<O, S>): Mark<O, S> {
    return new Mark<O, S>(config)
  }

  /**
   * Configure the mark with new options
   */
  configure(options: Partial<Options>): Mark<Options, Storage> {
    const newMark = new Mark<Options, Storage>(this.config)
    newMark.options = { ...this.options, ...options }
    return newMark
  }

  addNodes(): Record<string, NodeSpec> {
    return {}
  }

  /**
   * Build the MarkSpec for ProseMirror schema
   */
  addMarks(): Record<string, MarkSpec> {
    const spec: MarkSpec = {
      inclusive: this.config.inclusive,
      excludes: this.config.excludes,
      group: this.config.group,
      spanning: this.config.spanning,
      attrs: this.config.attrs,
    }

    if (this.config.parseHTML) {
      spec.parseDOM = this.config.parseHTML() as MarkSpec['parseDOM']
    }

    if (this.config.renderHTML) {
      spec.toDOM = (mark) => this.config.renderHTML!({
        mark: mark as unknown as MarkWithAttrs,
        HTMLAttributes: mark.attrs,
      })
    }

    // Remove undefined values
    Object.keys(spec).forEach((key) => {
      if (spec[key as keyof MarkSpec] === undefined) {
        delete spec[key as keyof MarkSpec]
      }
    })

    return { [this.name]: spec }
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
