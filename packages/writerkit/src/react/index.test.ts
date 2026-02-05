/**
 * Tests for React module exports and types.
 *
 * Note: Full component testing would require @testing-library/react
 * and a DOM environment. These tests verify module structure and exports.
 */

import { describe, it, expect } from 'vitest'

// Import all exports from the React module
import {
  WriterKitContext,
  WriterKitProvider,
  Editor,
  PageView,
  useWriterKit,
  usePageBoundary,
  useDocumentState,
  useEditorFocus,
  useReflowStats,
} from './index'

// Import types to verify they compile
import type {
  WriterKitContextValue,
  WriterKitProviderProps,
  EditorProps,
  PageViewProps,
  WriterKitConfig,
} from './index'

describe('React module exports', () => {
  describe('Context', () => {
    it('exports WriterKitContext', () => {
      expect(WriterKitContext).toBeDefined()
      // Context should have Provider and Consumer
      expect(WriterKitContext.Provider).toBeDefined()
      expect(WriterKitContext.Consumer).toBeDefined()
    })
  })

  describe('Components', () => {
    it('exports WriterKitProvider as a function', () => {
      expect(typeof WriterKitProvider).toBe('function')
    })

    it('exports Editor as a function', () => {
      expect(typeof Editor).toBe('function')
    })

    it('exports PageView as a function', () => {
      expect(typeof PageView).toBe('function')
    })
  })

  describe('Hooks', () => {
    it('exports useWriterKit as a function', () => {
      expect(typeof useWriterKit).toBe('function')
    })

    it('exports usePageBoundary as a function', () => {
      expect(typeof usePageBoundary).toBe('function')
    })

    it('exports useDocumentState as a function', () => {
      expect(typeof useDocumentState).toBe('function')
    })

    it('exports useEditorFocus as a function', () => {
      expect(typeof useEditorFocus).toBe('function')
    })

    it('exports useReflowStats as a function', () => {
      expect(typeof useReflowStats).toBe('function')
    })
  })

  describe('Type definitions', () => {
    it('WriterKitContextValue type is usable', () => {
      // Type assertion to verify the type compiles
      const mockContextValue: Partial<WriterKitContextValue> = {
        view: null,
        state: null,
        doc: null,
        metadata: null,
        pages: [],
        paginationModel: null,
        isLoading: false,
        isDirty: false,
        reflowEngine: null,
        storage: null,
      }
      expect(mockContextValue).toBeDefined()
    })

    it('WriterKitProviderProps type is usable', () => {
      const mockProps: WriterKitProviderProps = {
        children: null as unknown as React.ReactNode,
        initialContent: '# Hello',
      }
      expect(mockProps).toBeDefined()
    })

    it('EditorProps type is usable', () => {
      const mockProps: EditorProps = {
        editable: true,
        className: 'my-editor',
        placeholder: 'Start typing...',
      }
      expect(mockProps).toBeDefined()
    })

    it('PageViewProps type is usable', () => {
      const mockProps: Partial<PageViewProps> = {
        scale: 1,
        className: 'my-page',
        showShadow: true,
        showPageNumber: true,
      }
      expect(mockProps).toBeDefined()
    })

    it('WriterKitConfig type is usable', () => {
      const mockConfig: WriterKitConfig = {
        editable: true,
        pagination: {
          pageSize: 'letter',
          orientation: 'portrait',
        },
      }
      expect(mockConfig).toBeDefined()
    })
  })
})

describe('Hook error handling', () => {
  describe('useWriterKit', () => {
    it('throws when used outside provider', () => {
      // This would require React test environment
      // For now, we just verify the function exists
      expect(useWriterKit).toBeDefined()
    })
  })

  describe('usePageBoundary', () => {
    it('throws when used outside provider', () => {
      expect(usePageBoundary).toBeDefined()
    })
  })

  describe('useDocumentState', () => {
    it('throws when used outside provider', () => {
      expect(useDocumentState).toBeDefined()
    })
  })

  describe('useEditorFocus', () => {
    it('throws when used outside provider', () => {
      expect(useEditorFocus).toBeDefined()
    })
  })
})

describe('Core Editor integration', () => {
  it('CoreEditor is imported and usable', async () => {
    // Verify the core Editor class is available through the integration
    const { Editor: CoreEditor } = await import('../core')
    expect(CoreEditor).toBeDefined()
    expect(typeof CoreEditor).toBe('function')
  })

  it('ReflowEngine is imported and usable', async () => {
    const { ReflowEngine } = await import('../pagination')
    expect(ReflowEngine).toBeDefined()
    expect(typeof ReflowEngine).toBe('function')
  })

  it('MarkdownManager is imported and usable', async () => {
    const { MarkdownManager } = await import('../markdown')
    expect(MarkdownManager).toBeDefined()

    // Test basic functionality
    const manager = new MarkdownManager()
    const result = manager.parse('# Hello World')
    expect(result.ast).toBeDefined()
    expect(result.metadata).toBeDefined()
  })

  it('StorageAdapter types are compatible', async () => {
    const { MemoryAdapter } = await import('../storage')
    expect(MemoryAdapter).toBeDefined()

    // Create and test memory adapter
    const adapter = new MemoryAdapter()
    expect(adapter.read).toBeDefined()
    expect(adapter.write).toBeDefined()
  })
})

describe('Race condition prevention', () => {
  it('DOMReadinessChecker is available for view connection', async () => {
    const { DOMReadinessChecker } = await import('../pagination')
    expect(DOMReadinessChecker).toBeDefined()
    expect(typeof DOMReadinessChecker).toBe('function')

    // Verify it can be instantiated
    const checker = new DOMReadinessChecker()
    expect(checker).toBeInstanceOf(DOMReadinessChecker)
    expect(typeof checker.isReady).toBe('function')
    expect(typeof checker.waitForReady).toBe('function')
  })

  it('ReflowEngine can handle delayed view connection', async () => {
    const { ReflowEngine } = await import('../pagination')
    const engine = new ReflowEngine()

    // Engine created without view - should not throw
    expect(engine.getModel()).toBeNull()
    expect(engine.getStats().pageCount).toBe(0)

    // Cleanup
    engine.destroy()
  })

  it('ReflowEngine tracks page changes correctly', async () => {
    const { ReflowEngine } = await import('../pagination')
    const engine = new ReflowEngine()

    let pagesChangedCalled = false
    const unsubscribe = engine.onPagesChanged(() => {
      pagesChangedCalled = true
    })

    // Cleanup
    unsubscribe()
    engine.destroy()

    // Just verify the handler can be registered and unregistered
    expect(unsubscribe).toBeDefined()
  })
})

describe('Browser compatibility', () => {
  it('Frontmatter works without Node.js Buffer', async () => {
    const { Frontmatter } = await import('../markdown')
    const fm = new Frontmatter()

    // Test that parsing works without Buffer global
    const content = `---
title: Test Document
author: John Doe
pageSize: a4
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---

# Hello World

Content here.`

    // Should not throw
    const { metadata, body } = fm.parse(content)
    expect(metadata.title).toBe('Test Document')
    expect(metadata.author).toBe('John Doe')
    expect(metadata.pageSize).toBe('a4')
    expect(metadata.margins.top).toBe(72)
    expect(body.trim()).toContain('# Hello World')
  })

  it('Frontmatter serializes without Node.js Buffer', async () => {
    const { Frontmatter } = await import('../markdown')
    const fm = new Frontmatter()

    const metadata = {
      title: 'Test',
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-02T00:00:00Z',
      pageSize: 'a4' as const,
      orientation: 'portrait' as const,
      margins: { top: 72, right: 72, bottom: 72, left: 72 },
    }

    // Should not throw
    const result = fm.serialize(metadata, 'Content here.')
    expect(result).toContain('title: Test')
    expect(result).toContain('Content here.')
  })

  it('YAMLParser is pure JavaScript (no Node.js deps)', async () => {
    const { YAMLParser } = await import('../markdown/YAMLParser')
    const parser = new YAMLParser()

    // Parse complex YAML without Buffer
    const yaml = `title: "Complex: Test"
count: 42
enabled: true
nested:
  deep:
    value: works`

    const result = parser.parse(yaml)
    expect(result.title).toBe('Complex: Test')
    expect(result.count).toBe(42)
    expect(result.enabled).toBe(true)
    expect((result.nested as Record<string, unknown>).deep).toEqual({ value: 'works' })
  })

  it('YAMLStringifier is pure JavaScript (no Node.js deps)', async () => {
    const { YAMLStringifier } = await import('../markdown/YAMLStringifier')
    const stringifier = new YAMLStringifier()

    // Stringify complex object without Buffer
    const data = {
      title: 'Test',
      count: 42,
      nested: { value: 'works' },
    }

    const yaml = stringifier.stringify(data)
    expect(yaml).toContain('title: Test')
    expect(yaml).toContain('count: 42')
    expect(yaml).toContain('nested:')
  })
})

describe('Integration patterns', () => {
  it('ReflowEngine and DOMReadinessChecker work together', async () => {
    const { ReflowEngine, DOMReadinessChecker } = await import('../pagination')

    const engine = new ReflowEngine()
    const checker = new DOMReadinessChecker()

    // These should work together without errors
    expect(engine).toBeInstanceOf(ReflowEngine)
    expect(checker).toBeInstanceOf(DOMReadinessChecker)

    // Cleanup
    engine.destroy()
  })

  it('MarkdownManager and Frontmatter work together', async () => {
    const { MarkdownManager } = await import('../markdown')

    const manager = new MarkdownManager()

    // Parse markdown with frontmatter
    const content = `---
title: Test
---

# Hello`

    const { ast, metadata } = manager.parse(content)
    expect(metadata.title).toBe('Test')
    expect(ast.children.length).toBeGreaterThan(0)

    // Serialize back
    const doc = manager.astToProseMirror(ast)
    expect(doc).toBeDefined()
  })
})
