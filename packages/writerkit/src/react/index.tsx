/**
 * @writerkit/react
 *
 * React components and hooks for integrating WriterKit into React applications.
 * Provides the main Editor component, context providers, and hooks for
 * accessing document state and pagination.
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
import type {
  PageBoundary,
  PaginationModel,
  PaginationConfig,
  PageDimensions,
} from '../pagination'
import {
  ReflowEngine,
  createPageDimensions,
  DEFAULT_PAGINATION_CONFIG,
} from '../pagination'
import type { JSONContent, DocumentMetadata, WriterKitExtension } from '../core'
import { Editor as CoreEditor } from '../core'
import { MarkdownManager } from '../markdown'
import type { StorageAdapter } from '../storage'

// =============================================================================
// Types
// =============================================================================

/**
 * Editor configuration options
 */
export interface WriterKitConfig {
  /** Pagination configuration */
  pagination?: Partial<PaginationConfig>
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
  /** Page model array */
  pages: PageBoundary[]
  /** Current pagination model */
  paginationModel: PaginationModel | null
  /** Loading state */
  isLoading: boolean
  /** Whether document has unsaved changes */
  isDirty: boolean
  /** Reflow engine instance */
  reflowEngine: ReflowEngine | null
  /** Storage adapter */
  storage: StorageAdapter | null
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
  /** Save document */
  save: () => Promise<void>
  /** Load document by ID */
  load: (id: string) => Promise<void>
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
  /** Storage adapter for persistence */
  storage?: StorageAdapter | null
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
  storage = null,
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
  const [isLoading, setIsLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Pagination state
  const [pages, setPages] = useState<PageBoundary[]>([])
  const [paginationModel, setPaginationModel] = useState<PaginationModel | null>(null)
  const reflowEngineRef = useRef<ReflowEngine | null>(null)

  // Markdown manager
  const markdownManager = useMemo(() => new MarkdownManager(), [])

  // Initialize reflow engine
  useEffect(() => {
    const paginationConfig = {
      ...DEFAULT_PAGINATION_CONFIG,
      ...config.pagination,
    }
    const engine = new ReflowEngine(paginationConfig)

    engine.onPagesChanged((model) => {
      setPaginationModel(model)
      setPages(model.pages)
    })

    reflowEngineRef.current = engine

    return () => {
      engine.destroy()
      reflowEngineRef.current = null
    }
  }, [config.pagination])

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

    // Update reflow engine if page settings changed
    if (reflowEngineRef.current) {
      const paginationConfig: Partial<PaginationConfig> = {}
      if (newMetadata.pageSize) paginationConfig.pageSize = newMetadata.pageSize
      if (newMetadata.orientation) paginationConfig.orientation = newMetadata.orientation
      if (newMetadata.margins) paginationConfig.margins = newMetadata.margins
      if (Object.keys(paginationConfig).length > 0) {
        reflowEngineRef.current.setConfig(paginationConfig)
      }
    }
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

  const save = useCallback(async () => {
    if (!storage || !doc || !metadata) return
    setIsLoading(true)
    try {
      const markdown = getMarkdown()
      const now = new Date()
      await storage.write({
        id: metadata.title || 'untitled',
        content: markdown,
        metadata: { ...metadata },
        modifiedAt: now,
        createdAt: metadata.createdAt ? new Date(metadata.createdAt) : now,
      })
      setIsDirty(false)
    } finally {
      setIsLoading(false)
    }
  }, [storage, doc, metadata, getMarkdown])

  const load = useCallback(
    async (id: string) => {
      if (!storage) return
      setIsLoading(true)
      try {
        const document = await storage.read(id)
        if (document) {
          setContent(document.content)
          setIsDirty(false)
        }
      } finally {
        setIsLoading(false)
      }
    },
    [storage, setContent]
  )

  // Notify on changes
  useEffect(() => {
    if (doc && metadata) {
      onChange?.(doc, metadata)
    }
  }, [doc, metadata, onChange])

  // Internal setter for view registration
  const registerView = useCallback((editorView: EditorView | null) => {
    setView(editorView)
    if (editorView && reflowEngineRef.current) {
      reflowEngineRef.current.setView(editorView)
    }
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
      pages,
      paginationModel,
      isLoading,
      isDirty,
      reflowEngine: reflowEngineRef.current,
      storage,
      setContent,
      setMetadata,
      dispatch,
      focus,
      blur,
      getMarkdown,
      save,
      load,
    }),
    [
      view,
      state,
      doc,
      metadata,
      pages,
      paginationModel,
      isLoading,
      isDirty,
      storage,
      setContent,
      setMetadata,
      dispatch,
      focus,
      blur,
      getMarkdown,
      save,
      load,
    ]
  )

  // Expose internal methods via context for Editor component
  const internalContext = useMemo(
    () => ({
      ...contextValue,
      _registerView: registerView,
      _updateState: updateState,
      _reflowEngine: reflowEngineRef.current,
      _extensions: config.extensions ?? [],
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
  _reflowEngine?: ReflowEngine | null
  _extensions?: WriterKitExtension[]
}

/**
 * Main WriterKit editor component.
 * Renders a paginated, editable document with full ProseMirror integration.
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

    // Determine initial content
    let initialContent: string | undefined
    if (content) {
      initialContent = typeof content === 'string' ? content : undefined
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

          // Notify reflow engine of document changes
          if (context?._reflowEngine && e.view) {
            context._reflowEngine.requestReflow()
          }

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

      // Connect reflow engine
      if (context?._reflowEngine) {
        context._reflowEngine.setView(editor.view)
      }

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
// PageView Component
// =============================================================================

/**
 * Props for PageView component.
 */
export interface PageViewProps {
  /** Page boundary to render */
  page: PageBoundary
  /** Page scale factor */
  scale?: number
  /** CSS class name */
  className?: string
  /** Inline styles */
  style?: CSSProperties
  /** Page dimensions */
  dimensions?: PageDimensions
  /** Show page shadow */
  showShadow?: boolean
  /** Show page number */
  showPageNumber?: boolean
  /** Children to render in page content area */
  children?: ReactNode
}

/**
 * React component for rendering a single page.
 *
 * @example
 * ```tsx
 * const { pages } = useWriterKit()
 *
 * return (
 *   <div className="pages">
 *     {pages.map((page) => (
 *       <PageView key={page.pageNumber} page={page} scale={1} />
 *     ))}
 *   </div>
 * )
 * ```
 */
export function PageView({
  page,
  scale = 1,
  className = '',
  style,
  dimensions,
  showShadow = true,
  showPageNumber = true,
  children,
}: PageViewProps): React.ReactElement {
  const context = useContext(WriterKitContext)

  // Get dimensions from context or props
  const pageDimensions = dimensions || (context?.reflowEngine?.getDimensions() ?? getDefaultDimensions())
  const config = context?.reflowEngine?.getConfig() ?? DEFAULT_PAGINATION_CONFIG

  const pixelsPerPoint = config.pixelsPerPoint
  const width = pageDimensions.width * scale * pixelsPerPoint
  const height = pageDimensions.height * scale * pixelsPerPoint

  const margins = pageDimensions.margins
  const contentTop = (margins.top + pageDimensions.headerHeight) * scale * pixelsPerPoint
  const contentLeft = margins.left * scale * pixelsPerPoint
  const contentWidth = pageDimensions.contentWidth * scale * pixelsPerPoint
  const contentHeight = pageDimensions.contentHeight * scale * pixelsPerPoint

  const pageStyle: CSSProperties = {
    ...style,
    width: `${width}px`,
    height: `${height}px`,
    position: 'relative',
    background: 'white',
    boxSizing: 'border-box',
    overflow: 'hidden',
    ...(showShadow && { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' }),
  }

  const contentStyle: CSSProperties = {
    position: 'absolute',
    top: `${contentTop}px`,
    left: `${contentLeft}px`,
    width: `${contentWidth}px`,
    height: `${contentHeight}px`,
    overflow: 'hidden',
  }

  const pageNumberStyle: CSSProperties = {
    position: 'absolute',
    bottom: `${(margins.bottom / 2) * scale * pixelsPerPoint}px`,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: `${10 * scale}px`,
    color: '#999',
  }

  return (
    <div
      className={`writerkit-page ${className}`}
      style={pageStyle}
      data-page-number={page.pageNumber}
    >
      <div className="writerkit-page-content" style={contentStyle}>
        {children}
      </div>
      {showPageNumber && (
        <div className="writerkit-page-number" style={pageNumberStyle}>
          {page.pageNumber}
        </div>
      )}
    </div>
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
 *   const { doc, isDirty, save } = useWriterKit()
 *
 *   return (
 *     <button onClick={save} disabled={!isDirty}>
 *       Save
 *     </button>
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
 * Hook to access the current page model.
 * Returns the array of pages and pagination utilities.
 *
 * @example
 * ```tsx
 * function PageNavigator() {
 *   const { currentPage, totalPages, goToPage } = usePageBoundary()
 *
 *   return (
 *     <div>
 *       Page {currentPage} of {totalPages}
 *       <button onClick={() => goToPage(currentPage + 1)}>Next</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function usePageBoundary(): {
  pages: PageBoundary[]
  currentPage: number
  totalPages: number
  goToPage: (page: number) => void
  getPageForPosition: (pos: number) => number
} {
  const context = useContext(WriterKitContext)
  if (!context) {
    throw new Error('usePageBoundary must be used within a WriterKitProvider')
  }

  const [currentPage, setCurrentPage] = useState(1)

  const goToPage = useCallback(
    (page: number) => {
      const clampedPage = Math.max(1, Math.min(page, context.pages.length))
      setCurrentPage(clampedPage)

      // Scroll to page if there's a view
      if (context.view && context.paginationModel) {
        const pageData = context.pages[clampedPage - 1]
        if (pageData) {
          // Scroll editor to page start position
          const coords = context.view.coordsAtPos(pageData.startPos)
          if (coords) {
            context.view.dom.scrollTo({
              top: coords.top - 100,
              behavior: 'smooth',
            })
          }
        }
      }
    },
    [context.pages, context.view, context.paginationModel]
  )

  const getPageForPosition = useCallback(
    (pos: number) => {
      if (!context.reflowEngine || !context.paginationModel) return 1
      return context.reflowEngine.getPageForPosition(pos)
    },
    [context.reflowEngine, context.paginationModel]
  )

  return {
    pages: context.pages,
    currentPage,
    totalPages: context.pages.length,
    goToPage,
    getPageForPosition,
  }
}

/**
 * Hook to access document state and update methods.
 *
 * @example
 * ```tsx
 * function DocumentControls() {
 *   const { isDirty, save, load } = useDocumentState()
 *
 *   return (
 *     <div>
 *       <button onClick={save} disabled={!isDirty}>Save</button>
 *       <button onClick={() => load('my-doc')}>Load</button>
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
  save: () => Promise<void>
  load: (id: string) => Promise<void>
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
    save: context.save,
    load: context.load,
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

/**
 * Hook to access reflow/pagination stats for debugging.
 *
 * @example
 * ```tsx
 * function DebugPanel() {
 *   const stats = useReflowStats()
 *
 *   return (
 *     <pre>{JSON.stringify(stats, null, 2)}</pre>
 *   )
 * }
 * ```
 */
export function useReflowStats(): {
  pageCount: number
  reflowCount: number
  averageReflowTime: number
  cacheHitRate: number
} | null {
  const context = useContext(WriterKitContext)
  if (!context?.reflowEngine) return null

  const stats = context.reflowEngine.getStats()
  return {
    pageCount: stats.pageCount,
    reflowCount: stats.reflowCount,
    averageReflowTime: stats.averageReflowTime,
    cacheHitRate: stats.cacheStats.hitRate,
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
    pageSize: 'a4',
    orientation: 'portrait',
    margins: {
      top: 72,
      right: 72,
      bottom: 72,
      left: 72,
    },
  }
}

/**
 * Get default page dimensions
 */
function getDefaultDimensions(): PageDimensions {
  return createPageDimensions(DEFAULT_PAGINATION_CONFIG)
}
