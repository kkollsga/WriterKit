import type {
  WriterKitExtension,
  ExtensionCreateOptions,
  CommandFunction,
  InputRule,
  PasteRule,
  WriterKitEditor,
} from './types'
import type { NodeSpec, MarkSpec } from 'prosemirror-model'
import type { Plugin } from 'prosemirror-state'

/**
 * Default priority for extensions
 */
const DEFAULT_PRIORITY = 100

/**
 * Base class for creating WriterKit extensions
 *
 * Following TipTap's pattern of static create() factory
 */
export class Extension<
  Options extends Record<string, unknown> = Record<string, unknown>,
  Storage extends Record<string, unknown> = Record<string, unknown>
> implements WriterKitExtension<Options, Storage> {
  name: string
  type: 'node' | 'mark' | 'extension' = 'extension'
  priority: number
  options: Options
  storage: Storage

  private config: ExtensionCreateOptions<Options, Storage>

  protected constructor(config: ExtensionCreateOptions<Options, Storage>) {
    this.name = config.name
    this.priority = config.priority ?? DEFAULT_PRIORITY
    this.config = config
    this.options = config.addOptions?.() ?? ({} as Options)
    this.storage = config.addStorage?.() ?? ({} as Storage)
  }

  /**
   * Create a new extension
   *
   * @example
   * ```typescript
   * const MyExtension = Extension.create({
   *   name: 'myExtension',
   *   addOptions() {
   *     return { enabled: true }
   *   },
   *   addCommands() {
   *     return {
   *       myCommand: () => ({ state, dispatch }) => {
   *         // Command implementation
   *         return true
   *       }
   *     }
   *   }
   * })
   * ```
   */
  static create<
    O extends Record<string, unknown> = Record<string, unknown>,
    S extends Record<string, unknown> = Record<string, unknown>
  >(config: ExtensionCreateOptions<O, S>): Extension<O, S> {
    return new Extension<O, S>(config)
  }

  /**
   * Configure the extension with new options
   */
  configure(options: Partial<Options>): Extension<Options, Storage> {
    const newExtension = new Extension<Options, Storage>(this.config)
    newExtension.options = { ...this.options, ...options }
    return newExtension
  }

  // Schema methods - extensions typically don't add nodes/marks
  addNodes(): Record<string, NodeSpec> {
    return this.config.addNodes?.() ?? {}
  }

  addMarks(): Record<string, MarkSpec> {
    return this.config.addMarks?.() ?? {}
  }

  // Plugins
  addPlugins(): Plugin[] {
    return this.config.addPlugins?.call(this) ?? []
  }

  // Commands
  addCommands(): Record<string, (...args: unknown[]) => CommandFunction> {
    return this.config.addCommands?.call(this) ?? {}
  }

  // Keyboard shortcuts
  addKeyboardShortcuts(): Record<string, () => boolean> {
    return this.config.addKeyboardShortcuts?.call(this) ?? {}
  }

  // Input rules
  addInputRules(): InputRule[] {
    return this.config.addInputRules?.call(this) ?? []
  }

  // Paste rules
  addPasteRules(): PasteRule[] {
    return this.config.addPasteRules?.call(this) ?? []
  }

  // Lifecycle hooks
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
