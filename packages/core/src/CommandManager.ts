import type { Transaction } from 'prosemirror-state'
import type {
  CommandFunction,
  CommandProps,
  ChainedCommands,
  CanCommands,
  WriterKitEditor,
} from './types'

/**
 * Manages command execution with chain() and can() patterns.
 *
 * Commands can be:
 * - Chained: editor.chain().toggleBold().setItalic().run()
 * - Checked: editor.can().toggleBold() // returns boolean
 */
export class CommandManager {
  private commands: Record<string, (...args: unknown[]) => CommandFunction>
  private editor: WriterKitEditor

  constructor(
    commands: Record<string, (...args: unknown[]) => CommandFunction>,
    editor: WriterKitEditor
  ) {
    this.commands = commands
    this.editor = editor
  }

  /**
   * Create a chainable command interface.
   *
   * All commands in the chain are executed in a single transaction.
   * Call run() at the end to dispatch the transaction.
   *
   * @example
   * editor.chain().toggleBold().focus().run()
   */
  chain(): ChainedCommands {
    const { editor } = this
    const { state, view } = editor
    let tr = state.tr
    let shouldDispatch = true

    const chain: Record<string, (...args: unknown[]) => ChainedCommands> = {}

    // Build chainable methods for each command
    for (const [name, commandFactory] of Object.entries(this.commands)) {
      chain[name] = (...args: unknown[]) => {
        const command = commandFactory(...args)
        const props = this.createCommandProps(tr, true)

        // Execute command, accumulating changes in tr
        const result = command(props)
        if (!result) {
          shouldDispatch = false
        }
        tr = props.tr

        return chain as unknown as ChainedCommands
      }
    }

    // Add run() to dispatch the accumulated transaction
    ;(chain as unknown as ChainedCommands).run = () => {
      if (shouldDispatch && tr.docChanged) {
        view.dispatch(tr)
      }
      return shouldDispatch
    }

    return chain as unknown as ChainedCommands
  }

  /**
   * Create a command-check interface.
   *
   * Returns boolean indicating if command can be executed,
   * without actually executing it.
   *
   * @example
   * if (editor.can().toggleBold()) {
   *   // Bold can be applied/removed
   * }
   */
  can(): CanCommands {
    const { editor } = this
    const { state } = editor
    const can: Record<string, (...args: unknown[]) => boolean> = {}

    // Build check methods for each command
    for (const [name, commandFactory] of Object.entries(this.commands)) {
      can[name] = (...args: unknown[]) => {
        const command = commandFactory(...args)
        const tr = state.tr

        // Create props without dispatch to test if command would succeed
        const props = this.createCommandProps(tr, false)
        return command(props)
      }
    }

    return can as unknown as CanCommands
  }

  /**
   * Execute a single command directly.
   *
   * @example
   * editor.commands.toggleBold()
   */
  exec<T extends keyof typeof this.commands>(
    name: T,
    ...args: Parameters<typeof this.commands[T]>
  ): boolean {
    const commandFactory = this.commands[name as string]
    if (!commandFactory) {
      console.warn(`Command "${String(name)}" not found`)
      return false
    }

    const { state, view } = this.editor
    const tr = state.tr
    const props = this.createCommandProps(tr, true)

    const command = commandFactory(...args)
    const result = command(props)

    if (result && props.tr.docChanged) {
      view.dispatch(props.tr)
    }

    return result
  }

  /**
   * Create command props for execution or checking
   */
  private createCommandProps(
    tr: Transaction,
    canDispatch: boolean
  ): CommandProps {
    const { editor } = this
    const { state, view } = editor

    return {
      editor,
      state,
      view,
      tr,
      dispatch: canDispatch
        ? (transaction: Transaction) => {
            // Update the transaction reference for chaining
            Object.assign(tr, transaction)
          }
        : undefined,
      chain: () => this.chain(),
      can: () => this.can(),
    }
  }

  /**
   * Get all available command names
   */
  getCommandNames(): string[] {
    return Object.keys(this.commands)
  }

  /**
   * Check if a command exists
   */
  hasCommand(name: string): boolean {
    return name in this.commands
  }

  /**
   * Add a new command at runtime
   */
  addCommand(name: string, commandFactory: (...args: unknown[]) => CommandFunction): void {
    this.commands[name] = commandFactory
  }

  /**
   * Remove a command
   */
  removeCommand(name: string): boolean {
    if (name in this.commands) {
      delete this.commands[name]
      return true
    }
    return false
  }
}

/**
 * Built-in commands that are always available
 */
export const builtInCommands: Record<string, (...args: unknown[]) => CommandFunction> = {
  /**
   * Focus the editor
   */
  focus:
    () =>
    ({ view }) => {
      view.focus()
      return true
    },

  /**
   * Blur the editor
   */
  blur:
    () =>
    ({ view }) => {
      ;(view.dom as HTMLElement).blur()
      return true
    },

  /**
   * Set editor content (replaces entire document)
   */
  setContent:
    (_content: unknown) =>
    ({ tr, state, dispatch }) => {
      if (!dispatch) return true

      const doc = state.schema.nodeFromJSON(_content as { type: string })
      tr.replaceWith(0, state.doc.content.size, doc.content)
      return true
    },

  /**
   * Clear the editor content
   */
  clearContent:
    () =>
    ({ tr, state, dispatch }) => {
      if (!dispatch) return true

      tr.delete(0, state.doc.content.size)
      return true
    },

  /**
   * Insert text at current selection
   */
  insertText:
    (text: unknown) =>
    ({ tr, dispatch }) => {
      if (!dispatch) return true

      tr.insertText(text as string)
      return true
    },

  /**
   * Select all content
   */
  selectAll:
    () =>
    ({ tr, state, dispatch }) => {
      if (!dispatch) return true

      const { TextSelection } = require('prosemirror-state')
      tr.setSelection(TextSelection.create(state.doc, 0, state.doc.content.size))
      return true
    },
}
