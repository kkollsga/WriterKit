/**
 * @writerkit/react
 *
 * React components and hooks for integrating WriterKit into React applications.
 * Provides the main Editor component, context providers, and hooks for
 * accessing document state and pagination.
 *
 * @packageDocumentation
 */

import React from 'react';
import type { ReactNode } from 'react';
import type { PageBoundary } from '@writerkit/pagination';

/**
 * WriterKit context value type.
 */
export interface WriterKitContextValue {
  /** Editor instance */
  editor: unknown | null;
  /** Current document state */
  documentState: unknown | null;
  /** Page model array */
  pages: PageBoundary[];
  /** Loading state */
  isLoading: boolean;
}

/**
 * WriterKit React context.
 */
export const WriterKitContext = React.createContext<WriterKitContextValue | null>(null);

/**
 * Props for WriterKitProvider component.
 */
export interface WriterKitProviderProps {
  children: ReactNode;
  /** Initial document content */
  initialContent?: unknown;
  /** Storage adapter configuration */
  storage?: unknown;
}

/**
 * Context provider for WriterKit functionality.
 * Wraps the application to provide editor state and methods.
 */
export function WriterKitProvider(_props: WriterKitProviderProps): React.ReactElement {
  // TODO: Not implemented
  throw new Error('WriterKitProvider not implemented');
}

/**
 * Props for Editor component.
 */
export interface EditorProps {
  /** Initial content */
  content?: unknown;
  /** Whether editor is editable */
  editable?: boolean;
  /** Called when content changes */
  onUpdate?: (content: unknown) => void;
  /** CSS class name */
  className?: string;
}

/**
 * Main WriterKit editor component.
 * Renders a paginated, editable document.
 */
export function Editor(_props: EditorProps): React.ReactElement {
  // TODO: Not implemented
  throw new Error('Editor not implemented');
}

/**
 * Props for PageView component.
 */
export interface PageViewProps {
  /** Page model to render */
  page: PageBoundary;
  /** Page scale factor */
  scale?: number;
  /** CSS class name */
  className?: string;
}

/**
 * React component for rendering a single page.
 */
export function PageView(_props: PageViewProps): React.ReactElement {
  // TODO: Not implemented
  throw new Error('PageView not implemented');
}

/**
 * Hook to access WriterKit context.
 * Must be used within a WriterKitProvider.
 */
export function useWriterKit(): WriterKitContextValue {
  const context = React.useContext(WriterKitContext);
  if (!context) {
    throw new Error('useWriterKit must be used within a WriterKitProvider');
  }
  return context;
}

/**
 * Hook to access the current page model.
 * Returns the array of pages and pagination utilities.
 */
export function usePageBoundary(): {
  pages: PageBoundary[];
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
} {
  // TODO: Not implemented
  throw new Error('usePageBoundary not implemented');
}

/**
 * Hook to access document state and update methods.
 */
export function useDocumentState(): {
  content: unknown;
  isDirty: boolean;
  save: () => Promise<void>;
  load: (id: string) => Promise<void>;
} {
  // TODO: Not implemented
  throw new Error('useDocumentState not implemented');
}
