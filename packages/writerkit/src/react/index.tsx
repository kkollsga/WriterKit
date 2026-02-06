/**
 * @writerkit/react
 *
 * React components and hooks for integrating WriterKit into React applications.
 * Provides the main Editor component, context providers, and hooks for
 * accessing editor state.
 *
 * @packageDocumentation
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react'
import type { ReactNode, CSSProperties } from 'react'
import type { EditorView } from 'prosemirror-view'
import type { EditorState, Transaction } from 'prosemirror-state'
import type { JSONContent, DocumentMetadata, WriterKitExtension } from '../core'
import { Editor as CoreEditor } from '../core'
import { MarkdownManager, frontmatter } from '../markdown'

// =============================================================================
// Types
// =============================================================================

/**
 * Editor configuration options
 */
export interface WriterKitConfig {
  /** Extensions to load */
  extensions?: WriterKitExtension[]
  /** Whether the editor is editable */
  editable?: boolean
}

/**
 * WriterKit context value type.
 */
export interface WriterKitContextValue {
  /** ProseMirror EditorView instance */
  view: EditorView | null
  /** Current editor state */
  state: EditorState | null
  /** Current document as JSON */
  doc: JSONContent | null
  /** Document metadata */
  metadata: DocumentMetadata | null
  /** Loading state */
  isLoading: boolean
  /** Whether document has unsaved changes */
  isDirty: boolean
  /** Update editor content */
  setContent: (content: JSONContent | string) => void
  /** Update metadata */
  setMetadata: (metadata: Partial<DocumentMetadata>) => void
  /** Dispatch a transaction */
  dispatch: (tr: Transaction) => void
  /** Focus the editor */
  focus: () => void
  /** Blur the editor */
  blur: () => void
  /** Get current markdown */
  getMarkdown: () => string
}

/**
 * WriterKit React context.
 */
export const WriterKitContext = createContext<WriterKitContextValue | null>(null)

// =============================================================================
// Provider
// =============================================================================

/**
 * Props for WriterKitProvider component.
 */
export interface WriterKitProviderProps {
  children: ReactNode
  /** Initial document content (markdown string or JSON) */
  initialContent?: string | JSONContent
  /** Initial metadata */
  initialMetadata?: Partial<DocumentMetadata>
  /** Editor configuration */
  config?: WriterKitConfig
  /** Called when content changes */
  onChange?: (doc: JSONContent, metadata: DocumentMetadata) => void
  /** Called when dirty state changes */
  onDirtyChange?: (isDirty: boolean) => void
}

/**
 * Context provider for WriterKit functionality.
 * Wraps the application to provide editor state and methods.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <WriterKitProvider
 *       initialContent="# Hello World"
 *       onChange={(doc) => console.log('Changed:', doc)}
 *     >
 *       <Editor />
 *     </WriterKitProvider>
 *   )
 * }
 * ```
 */
export function WriterKitProvider({
  children,
  initialContent,
  initialMetadata,
  config = {},
  onChange,
  onDirtyChange,
}: WriterKitProviderProps): React.ReactElement {
  // Editor state
  const [view, setView] = useState<EditorView | null>(null)
  const [state, setState] = useState<EditorState | null>(null)
  const [doc, setDoc] = useState<JSONContent | null>(null)
  const [metadata, setMetadataState] = useState<DocumentMetadata | null>(
    initialMetadata ? { ...getDefaultMetadata(), ...initialMetadata } : null
  )
  const [isLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Store raw initial content for immediate access by Editor
  const initialContentRef = useRef<string | JSONContent | undefined>(initialContent)

  // Markdown manager
  const markdownManager = useMemo(() => new MarkdownManager(), [])

  // Parse initial content
  useEffect(() => {
    if (initialContent) {
      if (typeof initialContent === 'string') {
        const parsed = markdownManager.parse(initialContent)
        const doc = markdownManager.astToProseMirror(parsed.ast)
        setDoc(doc)
        setMetadataState((prev) => ({
          ...getDefaultMetadata(),
          ...prev,
          ...parsed.metadata,
        }))
      } else {
        setDoc(initialContent)
      }
    }
  }, [initialContent, markdownManager])

  // Track dirty state
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // Context methods
  const setContent = useCallback(
    (content: JSONContent | string) => {
      if (typeof content === 'string') {
        const parsed = markdownManager.parse(content)
        const doc = markdownManager.astToProseMirror(parsed.ast)
        setDoc(doc)
        setMetadataState((prev) => ({
          ...getDefaultMetadata(),
          ...prev,
          ...parsed.metadata,
        }))
      } else {
        setDoc(content)
      }
      setIsDirty(true)
    },
    [markdownManager]
  )

  const setMetadata = useCallback((newMetadata: Partial<DocumentMetadata>) => {
    setMetadataState((prev) => ({
      ...getDefaultMetadata(),
      ...prev,
      ...newMetadata,
    }))
    setIsDirty(true)
  }, [])

  const dispatch = useCallback(
    (tr: Transaction) => {
      if (view) {
        view.dispatch(tr)
        setIsDirty(true)
      }
    },
    [view]
  )

  const focus = useCallback(() => {
    view?.focus()
  }, [view])

  const blur = useCallback(() => {
    view?.dom.blur()
  }, [view])

  const getMarkdown = useCallback(() => {
    if (!doc || !metadata) return ''
    const result = markdownManager.serialize(doc, metadata)
    return result.markdown
  }, [doc, metadata, markdownManager])

  // Notify on changes
  useEffect(() => {
    if (doc && metadata) {
      onChange?.(doc, metadata)
    }
  }, [doc, metadata, onChange])

  // Internal setter for view registration
  const registerView = useCallback((editorView: EditorView | null) => {
    setView(editorView)
  }, [])

  // Internal setter for state updates
  const updateState = useCallback((newState: EditorState) => {
    setState(newState)
    setDoc(newState.doc.toJSON() as JSONContent)
  }, [])

  const contextValue = useMemo<WriterKitContextValue>(
    () => ({
      view,
      state,
      doc,
      metadata,
      isLoading,
      isDirty,
      setContent,
      setMetadata,
      dispatch,
      focus,
      blur,
      getMarkdown,
    }),
    [
      view,
      state,
      doc,
      metadata,
      isLoading,
      isDirty,
      setContent,
      setMetadata,
      dispatch,
      focus,
      blur,
      getMarkdown,
    ]
  )

  // Expose internal methods via context for Editor component
  const internalContext = useMemo(
    () => ({
      ...contextValue,
      _registerView: registerView,
      _updateState: updateState,
      _extensions: config.extensions ?? [],
      _initialContent: initialContentRef.current,
    }),
    [contextValue, registerView, updateState, config.extensions]
  )

  return (
    <WriterKitContext.Provider value={internalContext as WriterKitContextValue}>
      {children}
    </WriterKitContext.Provider>
  )
}

// =============================================================================
// Editor Component
// =============================================================================

/**
 * Props for Editor component.
 */
export interface EditorProps {
  /** Initial content (overrides provider content) */
  content?: string | JSONContent
  /** Whether editor is editable */
  editable?: boolean
  /** Called when content changes */
  onUpdate?: (doc: JSONContent) => void
  /** Called on selection change */
  onSelectionChange?: (selection: { from: number; to: number }) => void
  /** Called when editor is focused */
  onFocus?: () => void
  /** Called when editor is blurred */
  onBlur?: () => void
  /** CSS class name */
  className?: string
  /** Inline styles */
  style?: CSSProperties
  /** Placeholder text when empty */
  placeholder?: string
  /** Auto-focus on mount */
  autoFocus?: boolean
}

/**
 * Internal context type with private methods
 */
interface InternalContextValue extends WriterKitContextValue {
  _registerView?: (view: EditorView | null) => void
  _updateState?: (state: EditorState) => void
  _extensions?: WriterKitExtension[]
  _initialContent?: string | JSONContent
}

/**
 * Main WriterKit editor component.
 * Renders an editable document with full ProseMirror integration.
 *
 * @example
 * ```tsx
 * <WriterKitProvider>
 *   <Editor
 *     editable={true}
 *     onUpdate={(doc) => console.log(doc)}
 *     className="my-editor"
 *   />
 * </WriterKitProvider>
 * ```
 */
export function Editor({
  content,
  editable = true,
  onUpdate,
  onSelectionChange,
  onFocus,
  onBlur,
  className = '',
  style,
  placeholder,
  autoFocus = false,
}: EditorProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<CoreEditor | null>(null)
  const context = useContext(WriterKitContext) as InternalContextValue | null

  // Initialize core editor on mount
  useEffect(() => {
    if (!containerRef.current || editorRef.current) return

    // Get extensions from context config
    const extensions = context?._extensions ?? []

    // Determine initial content - use prop or fall back to provider's initial content
    // If content is a string, strip frontmatter before passing to editor
    let initialContent: string | undefined
    if (content) {
      if (typeof content === 'string') {
        // Strip frontmatter if present
        const { body } = frontmatter.parse(content)
        initialContent = body
      }
    } else if (context?._initialContent) {
      // Use the raw initial content from the provider (available immediately)
      if (typeof context._initialContent === 'string') {
        // Strip frontmatter if present
        const { body } = frontmatter.parse(context._initialContent)
        initialContent = body
      }
    }

    try {
      // Create core editor
      const editor = new CoreEditor({
        element: containerRef.current,
        extensions,
        content: initialContent,
        editable,
        onUpdate: ({ editor: e }) => {
          // Update context state
          context?._updateState?.(e.state)
          // Call user callback
          onUpdate?.(e.getJSON())
        },
        onSelectionUpdate: ({ editor: e }) => {
          const { from, to } = e.state.selection
          onSelectionChange?.({ from, to })
        },
      })

      editorRef.current = editor

      // Register view with context
      context?._registerView?.(editor.view)

      // Set up focus/blur handlers
      editor.on('focus', () => onFocus?.())
      editor.on('blur', () => onBlur?.())

      // Auto-focus if requested
      if (autoFocus) {
        editor.focus()
      }
    } catch (error) {
      console.error('WriterKit: Failed to initialize editor', error)
    }

    // Cleanup on unmount
    return () => {
      if (editorRef.current) {
        context?._registerView?.(null)
        editorRef.current.destroy()
        editorRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Update editable state
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setEditable(editable)
    }
  }, [editable])

  // Update content when it changes externally
  useEffect(() => {
    if (content && editorRef.current) {
      editorRef.current.setContent(content)
    }
  }, [content])

  const editorStyle: CSSProperties = {
    ...style,
    outline: 'none',
    minHeight: '100%',
  }

  // Show placeholder when editor is empty and unfocused
  const showPlaceholder = placeholder && !editorRef.current?.isEmpty === false

  return (
    <div
      ref={containerRef}
      className={`writerkit-editor ${className}`}
      style={editorStyle}
      data-editable={editable}
      data-placeholder={showPlaceholder ? placeholder : undefined}
    />
  )
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access WriterKit context.
 * Must be used within a WriterKitProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { doc, isDirty } = useWriterKit()
 *
 *   return (
 *     <div>
 *       {isDirty && <span>Unsaved changes</span>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useWriterKit(): WriterKitContextValue {
  const context = useContext(WriterKitContext)
  if (!context) {
    throw new Error('useWriterKit must be used within a WriterKitProvider')
  }
  return context
}

/**
 * Hook to access document state and update methods.
 *
 * @example
 * ```tsx
 * function DocumentControls() {
 *   const { isDirty, setContent, getMarkdown } = useDocumentState()
 *
 *   return (
 *     <div>
 *       <button onClick={() => console.log(getMarkdown())}>
 *         Export Markdown
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useDocumentState(): {
  content: JSONContent | null
  metadata: DocumentMetadata | null
  isDirty: boolean
  isLoading: boolean
  setContent: (content: JSONContent | string) => void
  setMetadata: (metadata: Partial<DocumentMetadata>) => void
  getMarkdown: () => string
} {
  const context = useContext(WriterKitContext)
  if (!context) {
    throw new Error('useDocumentState must be used within a WriterKitProvider')
  }

  return {
    content: context.doc,
    metadata: context.metadata,
    isDirty: context.isDirty,
    isLoading: context.isLoading,
    setContent: context.setContent,
    setMetadata: context.setMetadata,
    getMarkdown: context.getMarkdown,
  }
}

/**
 * Hook to access editor focus state and methods.
 *
 * @example
 * ```tsx
 * function EditorToolbar() {
 *   const { isFocused, focus, blur } = useEditorFocus()
 *
 *   return (
 *     <div>
 *       <button onClick={focus}>Focus Editor</button>
 *       {isFocused && <span>Editing...</span>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useEditorFocus(): {
  isFocused: boolean
  focus: () => void
  blur: () => void
} {
  const context = useContext(WriterKitContext)
  if (!context) {
    throw new Error('useEditorFocus must be used within a WriterKitProvider')
  }

  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!context.view) return

    const handleFocus = () => setIsFocused(true)
    const handleBlur = () => setIsFocused(false)

    context.view.dom.addEventListener('focus', handleFocus)
    context.view.dom.addEventListener('blur', handleBlur)

    return () => {
      context.view?.dom.removeEventListener('focus', handleFocus)
      context.view?.dom.removeEventListener('blur', handleBlur)
    }
  }, [context.view])

  return {
    isFocused,
    focus: context.focus,
    blur: context.blur,
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Get default document metadata
 */
function getDefaultMetadata(): DocumentMetadata {
  return {
    title: 'Untitled',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  }
}
