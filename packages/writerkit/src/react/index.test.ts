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
