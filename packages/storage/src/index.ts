/**
 * @writerkit/storage
 *
 * Storage adapters and state management for WriterKit documents.
 * Provides pluggable storage backends (FileSystem, IndexedDB) and
 * centralized state management for document persistence.
 *
 * @packageDocumentation
 */

/**
 * Abstract storage adapter interface for document persistence.
 * Implementations should handle reading/writing document data to various backends.
 */
export interface StorageAdapter {
  /** Read document data from storage */
  read(id: string): Promise<unknown>;
  /** Write document data to storage */
  write(id: string, data: unknown): Promise<void>;
  /** Delete document from storage */
  delete(id: string): Promise<void>;
  /** Check if document exists */
  exists(id: string): Promise<boolean>;
}

/**
 * FileSystem-based storage adapter.
 * Uses the File System Access API for browser-based file storage.
 */
export class FileSystemAdapter implements StorageAdapter {
  // TODO: Not implemented
  async read(_id: string): Promise<unknown> {
    throw new Error('FileSystemAdapter.read not implemented');
  }

  async write(_id: string, _data: unknown): Promise<void> {
    throw new Error('FileSystemAdapter.write not implemented');
  }

  async delete(_id: string): Promise<void> {
    throw new Error('FileSystemAdapter.delete not implemented');
  }

  async exists(_id: string): Promise<boolean> {
    throw new Error('FileSystemAdapter.exists not implemented');
  }
}

/**
 * IndexedDB-based storage adapter.
 * Uses IndexedDB for persistent browser storage with better capacity limits.
 */
export class IndexedDBAdapter implements StorageAdapter {
  // TODO: Not implemented
  async read(_id: string): Promise<unknown> {
    throw new Error('IndexedDBAdapter.read not implemented');
  }

  async write(_id: string, _data: unknown): Promise<void> {
    throw new Error('IndexedDBAdapter.write not implemented');
  }

  async delete(_id: string): Promise<void> {
    throw new Error('IndexedDBAdapter.delete not implemented');
  }

  async exists(_id: string): Promise<boolean> {
    throw new Error('IndexedDBAdapter.exists not implemented');
  }
}

/**
 * Centralized state manager for WriterKit documents.
 * Coordinates document state with storage adapters and provides
 * undo/redo, autosave, and state synchronization.
 */
export class StateManager {
  // TODO: Not implemented
  private adapter: StorageAdapter | null = null;

  setAdapter(_adapter: StorageAdapter): void {
    // TODO: Not implemented
    this.adapter = _adapter;
  }

  getAdapter(): StorageAdapter | null {
    return this.adapter;
  }

  async save(): Promise<void> {
    throw new Error('StateManager.save not implemented');
  }

  async load(_id: string): Promise<unknown> {
    throw new Error('StateManager.load not implemented');
  }
}
