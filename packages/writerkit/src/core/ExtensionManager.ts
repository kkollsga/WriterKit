import type {
  WriterKitExtension,
  CommandFunction,
  InputRule,
  PasteRule,
} from './types'
import type { NodeSpec, MarkSpec } from 'prosemirror-model'
import type { Plugin } from 'prosemirror-state'

/**
 * Manages extension resolution, flattening, and priority sorting.
 *
 * Extensions can be nested (via addExtensions()) and this manager
 * flattens them into a single list, sorted by priority.
 */
export class ExtensionManager {
  private extensions: WriterKitExtension[]

  constructor(extensions: WriterKitExtension[]) {
    this.extensions = this.resolveExtensions(extensions)
  }

  /**
   * Resolve and flatten nested extensions.
   *
   * Extensions may include other extensions via addExtensions().
   * This method recursively collects all extensions and flattens
   * them into a single list, sorted by priority (higher first).
   */
  private resolveExtensions(extensions: WriterKitExtension[]): WriterKitExtension[] {
    const resolved: WriterKitExtension[] = []
    const seen = new Set<string>()

    const collect = (exts: WriterKitExtension[]) => {
      for (const ext of exts) {
        // Skip duplicates by name (first wins)
        if (seen.has(ext.name)) {
          continue
        }
        seen.add(ext.name)

        // Recursively resolve nested extensions
        // Extension type may have addExtensions() if it's an Extension (not Node/Mark)
        const nested = (ext as ExtensionWithNested).addExtensions?.()
        if (nested && nested.length > 0) {
          collect(nested)
        }

        resolved.push(ext)
      }
    }

    collect(extensions)

    // Sort by priority (higher priority = earlier in list)
    return resolved.sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100))
  }

  /**
   * Get all resolved extensions
   */
  getExtensions(): WriterKitExtension[] {
    return this.extensions
  }

  /**
   * Get extensions by type
   */
  getExtensionsByType(type: 'node' | 'mark' | 'extension'): WriterKitExtension[] {
    return this.extensions.filter(ext => ext.type === type)
  }

  /**
   * Get an extension by name
   */
  getExtension(name: string): WriterKitExtension | undefined {
    return this.extensions.find(ext => ext.name === name)
  }

  /**
   * Collect all NodeSpecs from extensions
   */
  collectNodes(): Record<string, NodeSpec> {
    const nodes: Record<string, NodeSpec> = {}

    for (const ext of this.extensions) {
      const extNodes = ext.addNodes?.()
      if (extNodes) {
        Object.assign(nodes, extNodes)
      }
    }

    return nodes
  }

  /**
   * Collect all MarkSpecs from extensions
   */
  collectMarks(): Record<string, MarkSpec> {
    const marks: Record<string, MarkSpec> = {}

    for (const ext of this.extensions) {
      const extMarks = ext.addMarks?.()
      if (extMarks) {
        Object.assign(marks, extMarks)
      }
    }

    return marks
  }

  /**
   * Collect all plugins from extensions
   */
  collectPlugins(): Plugin[] {
    const plugins: Plugin[] = []

    for (const ext of this.extensions) {
      const extPlugins = ext.addPlugins?.()
      if (extPlugins) {
        plugins.push(...extPlugins)
      }
    }

    return plugins
  }

  /**
   * Collect all commands from extensions
   */
  collectCommands(): Record<string, (...args: unknown[]) => CommandFunction> {
    const commands: Record<string, (...args: unknown[]) => CommandFunction> = {}

    for (const ext of this.extensions) {
      const extCommands = ext.addCommands?.()
      if (extCommands) {
        Object.assign(commands, extCommands)
      }
    }

    return commands
  }

  /**
   * Collect all keyboard shortcuts from extensions
   */
  collectKeyboardShortcuts(): Record<string, () => boolean> {
    const shortcuts: Record<string, () => boolean> = {}

    for (const ext of this.extensions) {
      const extShortcuts = ext.addKeyboardShortcuts?.()
      if (extShortcuts) {
        Object.assign(shortcuts, extShortcuts)
      }
    }

    return shortcuts
  }

  /**
   * Collect all input rules from extensions
   */
  collectInputRules(): InputRule[] {
    const rules: InputRule[] = []

    for (const ext of this.extensions) {
      const extRules = ext.addInputRules?.()
      if (extRules) {
        rules.push(...extRules)
      }
    }

    return rules
  }

  /**
   * Collect all paste rules from extensions
   */
  collectPasteRules(): PasteRule[] {
    const rules: PasteRule[] = []

    for (const ext of this.extensions) {
      const extRules = ext.addPasteRules?.()
      if (extRules) {
        rules.push(...extRules)
      }
    }

    return rules
  }

  /**
   * Call onCreate on all extensions
   */
  callOnCreate(props: { editor: unknown }): void {
    for (const ext of this.extensions) {
      ext.onCreate?.(props as { editor: import('./types').WriterKitEditor })
    }
  }

  /**
   * Call onUpdate on all extensions
   */
  callOnUpdate(props: { editor: unknown }): void {
    for (const ext of this.extensions) {
      ext.onUpdate?.(props as { editor: import('./types').WriterKitEditor })
    }
  }

  /**
   * Call onDestroy on all extensions
   */
  callOnDestroy(): void {
    for (const ext of this.extensions) {
      ext.onDestroy?.()
    }
  }

  /**
   * Call onSelectionUpdate on all extensions
   */
  callOnSelectionUpdate(props: { editor: unknown }): void {
    for (const ext of this.extensions) {
      ext.onSelectionUpdate?.(props as { editor: import('./types').WriterKitEditor })
    }
  }

  /**
   * Get extension storage map
   */
  getStorage(): Record<string, unknown> {
    const storage: Record<string, unknown> = {}

    for (const ext of this.extensions) {
      storage[ext.name] = ext.storage
    }

    return storage
  }
}

/**
 * Internal interface for extensions that can contain nested extensions
 */
interface ExtensionWithNested extends WriterKitExtension {
  addExtensions?(): WriterKitExtension[]
}
