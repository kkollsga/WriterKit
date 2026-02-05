import { Schema, DOMParser, DOMSerializer } from 'prosemirror-model'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { EditorState, Transaction } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap } from 'prosemirror-commands'
import { history } from 'prosemirror-history'

import { ExtensionManager } from './ExtensionManager'
import { CommandManager, builtInCommands } from './CommandManager'
import type {
  EditorConfig,
  WriterKitEditor,
  WriterKitExtension,
  JSONContent,
  EditorEvents,
  ChainedCommands,
  CanCommands,
} from './types'

/**
 * Main WriterKit editor class.
 *
 * Wraps ProseMirror with a developer-friendly API including:
 * - Extension system for nodes, marks, and behaviors
 * - Chainable commands: editor.chain().toggleBold().run()
 * - Command checks: editor.can().toggleBold()
 * - Event system for updates, selection changes, etc.
 *
 * @example
 * ```typescript
 * import { Editor, Node, Mark } from '../core'
 *
 * const editor = new Editor({
 *   element: document.getElementById('editor'),
 *   extensions: [Document, Paragraph, Text, Bold, Italic],
 *   content: '# Hello World',
 *   onUpdate: ({ editor }) => {
 *     console.log(editor.getMarkdown())
 *   }
 * })
 * ```
 */
export class Editor implements WriterKitEditor {
  private extensionManager: ExtensionManager
  private commandManager!: CommandManager
  private eventHandlers: Map<keyof EditorEvents, Set<EditorEvents[keyof EditorEvents]>>
  private isDestroyed = false

  /** The ProseMirror EditorView */
  view!: EditorView

  /** Current ProseMirror EditorState */
  get state(): EditorState {
    return this.view.state
  }

  /** The ProseMirror Schema */
  schema!: Schema

  /** Storage for all extensions, keyed by extension name */
  storage: Record<string, unknown>

  constructor(config: EditorConfig) {
    this.eventHandlers = new Map()
    this.extensionManager = new ExtensionManager(config.extensions ?? [])
    this.storage = this.extensionManager.getStorage()

    // Build schema from extensions
    this.schema = this.createSchema()

    // Create ProseMirror state
    const state = this.createState(config.content)

    // Create ProseMirror view
    this.view = this.createView(config.element, state, config.editable ?? true)

    // Initialize command manager
    const commands = {
      ...builtInCommands,
      ...this.extensionManager.collectCommands(),
    }
    this.commandManager = new CommandManager(commands, this)

    // Set up event callbacks from config
    if (config.onUpdate) {
      this.on('update', config.onUpdate)
    }
    if (config.onSelectionUpdate) {
      this.on('selectionUpdate', config.onSelectionUpdate)
    }

    // Call onCreate on all extensions
    this.extensionManager.callOnCreate({ editor: this })

    // Emit create event
    this.emit('create', { editor: this })
  }

  /**
   * Create ProseMirror schema from extension specs
   */
  private createSchema(): Schema {
    const nodes = this.extensionManager.collectNodes()
    const marks = this.extensionManager.collectMarks()

    // Ensure we have the basic required nodes
    if (!nodes.doc) {
      nodes.doc = { content: 'block+' }
    }
    if (!nodes.text) {
      nodes.text = { group: 'inline' }
    }
    if (!nodes.paragraph) {
      nodes.paragraph = {
        group: 'block',
        content: 'inline*',
        parseDOM: [{ tag: 'p' }],
        toDOM: () => ['p', 0],
      }
    }

    return new Schema({ nodes, marks })
  }

  /**
   * Create initial ProseMirror state
   */
  private createState(content?: string): EditorState {
    let doc: ProseMirrorNode

    if (content) {
      // Parse markdown or HTML content
      // For now, we parse as HTML - markdown parsing comes from @writerkit/markdown
      const element = document.createElement('div')
      element.innerHTML = this.contentToHTML(content)
      doc = DOMParser.fromSchema(this.schema).parse(element)
    } else {
      // Empty document
      doc = this.schema.node('doc', null, [
        this.schema.node('paragraph'),
      ])
    }

    // Collect plugins from extensions
    const extensionPlugins = this.extensionManager.collectPlugins()

    // Build keyboard shortcuts from extensions
    const shortcuts = this.extensionManager.collectKeyboardShortcuts()
    const shortcutKeymap = Object.entries(shortcuts).reduce(
      (acc, [key, handler]) => {
        acc[key] = () => handler()
        return acc
      },
      {} as Record<string, () => boolean>
    )

    return EditorState.create({
      doc,
      plugins: [
        history(),
        keymap(shortcutKeymap),
        keymap(baseKeymap),
        ...extensionPlugins,
      ],
    })
  }

  /**
   * Convert content string to HTML for initial parsing
   * (Basic implementation - full markdown support via @writerkit/markdown)
   */
  private contentToHTML(content: string): string {
    // If it looks like HTML, use as-is
    if (content.trim().startsWith('<')) {
      return content
    }

    // Basic markdown-to-HTML conversion for initial loading
    // Full markdown support will come from @writerkit/markdown package
    let html = content

    // Convert headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

    // Convert bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

    // Convert paragraphs (double newlines)
    html = html
      .split(/\n\n+/)
      .map(p => {
        const trimmed = p.trim()
        if (!trimmed) return ''
        if (trimmed.startsWith('<')) return trimmed
        return `<p>${trimmed}</p>`
      })
      .join('')

    return html
  }

  /**
   * Create ProseMirror EditorView
   */
  private createView(
    element: HTMLElement | undefined,
    state: EditorState,
    editable: boolean
  ): EditorView {
    const view = new EditorView(element ?? null, {
      state,
      editable: () => editable,
      dispatchTransaction: (tr: Transaction) => {
        if (this.isDestroyed) return

        const newState = this.view.state.apply(tr)
        this.view.updateState(newState)

        // Call extension hooks
        if (tr.docChanged) {
          this.extensionManager.callOnUpdate({ editor: this })
          this.emit('update', { editor: this, transaction: tr })
        }

        if (tr.selectionSet) {
          this.extensionManager.callOnSelectionUpdate({ editor: this })
          this.emit('selectionUpdate', { editor: this })
        }
      },
      handleDOMEvents: {
        focus: (_view, event) => {
          this.emit('focus', { editor: this, event })
          return false
        },
        blur: (_view, event) => {
          this.emit('blur', { editor: this, event })
          return false
        },
      },
    })

    return view
  }

  /**
   * Destroy the editor and clean up
   */
  destroy(): void {
    if (this.isDestroyed) return

    this.isDestroyed = true
    this.extensionManager.callOnDestroy()
    this.emit('destroy')
    this.view.destroy()
    this.eventHandlers.clear()
  }

  /**
   * Get content as markdown string
   * (Basic implementation - full support via @writerkit/markdown)
   */
  getMarkdown(): string {
    // This is a placeholder - full implementation comes from @writerkit/markdown
    const html = this.getHTML()
    return this.htmlToMarkdown(html)
  }

  /**
   * Get content as JSON (ProseMirror document structure)
   */
  getJSON(): JSONContent {
    return this.state.doc.toJSON() as JSONContent
  }

  /**
   * Get content as HTML string
   */
  getHTML(): string {
    const fragment = DOMSerializer.fromSchema(this.schema).serializeFragment(
      this.state.doc.content
    )
    const div = document.createElement('div')
    div.appendChild(fragment)
    return div.innerHTML
  }

  /**
   * Set editor content
   */
  setContent(content: string | JSONContent): void {
    let doc: ProseMirrorNode

    if (typeof content === 'string') {
      const element = document.createElement('div')
      element.innerHTML = this.contentToHTML(content)
      doc = DOMParser.fromSchema(this.schema).parse(element)
    } else {
      doc = this.schema.nodeFromJSON(content)
    }

    const tr = this.state.tr.replaceWith(
      0,
      this.state.doc.content.size,
      doc.content
    )
    this.view.dispatch(tr)
  }

  /**
   * Basic HTML to Markdown conversion
   * (Placeholder - full support via @writerkit/markdown)
   */
  private htmlToMarkdown(html: string): string {
    let md = html

    // Convert headings
    md = md.replace(/<h1[^>]*>(.+?)<\/h1>/gi, '# $1\n\n')
    md = md.replace(/<h2[^>]*>(.+?)<\/h2>/gi, '## $1\n\n')
    md = md.replace(/<h3[^>]*>(.+?)<\/h3>/gi, '### $1\n\n')

    // Convert formatting
    md = md.replace(/<strong>(.+?)<\/strong>/gi, '**$1**')
    md = md.replace(/<b>(.+?)<\/b>/gi, '**$1**')
    md = md.replace(/<em>(.+?)<\/em>/gi, '*$1*')
    md = md.replace(/<i>(.+?)<\/i>/gi, '*$1*')

    // Convert paragraphs
    md = md.replace(/<p[^>]*>(.+?)<\/p>/gi, '$1\n\n')

    // Clean up
    md = md.replace(/<[^>]+>/g, '') // Remove remaining tags
    md = md.replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
    md = md.trim()

    return md
  }

  /**
   * Create a chainable command sequence
   *
   * @example
   * editor.chain().toggleBold().focus().run()
   */
  chain(): ChainedCommands {
    return this.commandManager.chain()
  }

  /**
   * Check if commands can be executed
   *
   * @example
   * if (editor.can().toggleBold()) { ... }
   */
  can(): CanCommands {
    return this.commandManager.can()
  }

  /**
   * Register an event handler
   */
  on<E extends keyof EditorEvents>(event: E, handler: EditorEvents[E]): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  /**
   * Remove an event handler
   */
  off<E extends keyof EditorEvents>(event: E, handler: EditorEvents[E]): void {
    this.eventHandlers.get(event)?.delete(handler)
  }

  /**
   * Emit an event to all handlers
   */
  private emit<E extends keyof EditorEvents>(
    event: E,
    ...args: Parameters<EditorEvents[E]>
  ): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        ;(handler as (...args: unknown[]) => void)(...args)
      }
    }
  }

  /**
   * Check if the editor is editable
   */
  get isEditable(): boolean {
    return this.view.editable
  }

  /**
   * Set whether the editor is editable
   */
  setEditable(editable: boolean): void {
    this.view.setProps({ editable: () => editable })
  }

  /**
   * Focus the editor
   */
  focus(): void {
    this.view.focus()
  }

  /**
   * Check if the editor is focused
   */
  get isFocused(): boolean {
    return this.view.hasFocus()
  }

  /**
   * Check if the editor has been destroyed
   */
  get isDestroyed_(): boolean {
    return this.isDestroyed
  }

  /**
   * Get the extension manager
   */
  get extensions(): ExtensionManager {
    return this.extensionManager
  }

  /**
   * Get an extension by name
   */
  getExtension(name: string): WriterKitExtension | undefined {
    return this.extensionManager.getExtension(name)
  }

  /**
   * Check if document is empty
   */
  get isEmpty(): boolean {
    const { doc } = this.state
    return doc.textContent.length === 0 && doc.childCount <= 1
  }

  /**
   * Get the character count
   */
  get characterCount(): number {
    return this.state.doc.textContent.length
  }

  /**
   * Get the word count
   */
  get wordCount(): number {
    const text = this.state.doc.textContent
    if (!text.trim()) return 0
    return text.trim().split(/\s+/).length
  }
}
