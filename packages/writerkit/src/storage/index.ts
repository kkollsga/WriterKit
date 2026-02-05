/**
 * @writerkit/storage
 *
 * Storage adapters and state management for WriterKit documents.
 * Provides pluggable storage backends (FileSystem, IndexedDB, Memory) and
 * centralized state management for document persistence.
 *
 * @packageDocumentation
 */

/**
 * Configuration for storage adapters.
 */
export interface StorageAdapterConfig {
  /** Database or storage name */
  name?: string
  /** Storage version */
  version?: number
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number
}

/**
 * Stored document structure.
 */
export interface StoredDocument {
  /** Unique document identifier */
  id: string
  /** Document content (markdown or JSON) */
  content: string
  /** Document metadata */
  metadata?: Record<string, unknown>
  /** Last modified timestamp */
  modifiedAt: Date
  /** Created timestamp */
  createdAt: Date
}

/**
 * Document state for tracking changes.
 */
export type DocumentState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; document: StoredDocument }
  | { status: 'modified'; document: StoredDocument; since: Date }
  | { status: 'saving' }
  | { status: 'saved'; document: StoredDocument; at: Date }
  | { status: 'error'; error: Error }

/**
 * Events emitted by DocumentStateManager.
 */
export interface DocumentStateEvents {
  stateChanged: (state: DocumentState) => void
  saved: (document: StoredDocument) => void
  loaded: (document: StoredDocument) => void
  error: (error: Error) => void
}

/**
 * Abstract storage adapter interface for document persistence.
 * Implementations should handle reading/writing document data to various backends.
 */
export abstract class StorageAdapter {
  protected config: StorageAdapterConfig

  constructor(config: StorageAdapterConfig = {}) {
    this.config = config
  }

  /** Read document data from storage */
  abstract read(id: string): Promise<StoredDocument | null>

  /** Write document data to storage */
  abstract write(document: StoredDocument): Promise<void>

  /** Delete document from storage */
  abstract delete(id: string): Promise<void>

  /** Check if document exists */
  abstract exists(id: string): Promise<boolean>

  /** List all document IDs */
  abstract list(): Promise<string[]>
}

/**
 * FileSystem-based storage adapter.
 * Uses the File System Access API for browser-based file storage.
 */
export class FileSystemAdapter extends StorageAdapter {
  private directoryHandle: FileSystemDirectoryHandle | null = null

  async setDirectory(handle: FileSystemDirectoryHandle): Promise<void> {
    this.directoryHandle = handle
  }

  async read(id: string): Promise<StoredDocument | null> {
    if (!this.directoryHandle) {
      throw new Error('FileSystemAdapter: No directory handle set')
    }

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(`${id}.md`)
      const file = await fileHandle.getFile()
      const content = await file.text()

      return {
        id,
        content,
        modifiedAt: new Date(file.lastModified),
        createdAt: new Date(file.lastModified),
      }
    } catch {
      return null
    }
  }

  async write(document: StoredDocument): Promise<void> {
    if (!this.directoryHandle) {
      throw new Error('FileSystemAdapter: No directory handle set')
    }

    const fileHandle = await this.directoryHandle.getFileHandle(`${document.id}.md`, {
      create: true,
    })
    const writable = await fileHandle.createWritable()
    await writable.write(document.content)
    await writable.close()
  }

  async delete(id: string): Promise<void> {
    if (!this.directoryHandle) {
      throw new Error('FileSystemAdapter: No directory handle set')
    }

    await this.directoryHandle.removeEntry(`${id}.md`)
  }

  async exists(id: string): Promise<boolean> {
    if (!this.directoryHandle) return false

    try {
      await this.directoryHandle.getFileHandle(`${id}.md`)
      return true
    } catch {
      return false
    }
  }

  async list(): Promise<string[]> {
    if (!this.directoryHandle) return []

    const ids: string[] = []
    // Cast to any for async iteration support (File System Access API)
    const handle = this.directoryHandle as unknown as AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle>
    for await (const entry of handle) {
      if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        ids.push(entry.name.replace('.md', ''))
      }
    }
    return ids
  }
}

/**
 * IndexedDB-based storage adapter.
 * Uses IndexedDB for persistent browser storage with better capacity limits.
 */
export class IndexedDBAdapter extends StorageAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null
  private readonly storeName = 'documents'

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.config.name || 'writerkit', this.config.version || 1)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' })
          }
        }
      })
    }
    return this.dbPromise
  }

  async read(id: string): Promise<StoredDocument | null> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  async write(document: StoredDocument): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put(document)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async exists(id: string): Promise<boolean> {
    const document = await this.read(id)
    return document !== null
  }

  async list(): Promise<string[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAllKeys()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result as string[])
    })
  }
}

/**
 * In-memory storage adapter for testing and temporary storage.
 */
export class MemoryAdapter extends StorageAdapter {
  private documents: Map<string, StoredDocument> = new Map()

  async read(id: string): Promise<StoredDocument | null> {
    return this.documents.get(id) || null
  }

  async write(document: StoredDocument): Promise<void> {
    this.documents.set(document.id, document)
  }

  async delete(id: string): Promise<void> {
    this.documents.delete(id)
  }

  async exists(id: string): Promise<boolean> {
    return this.documents.has(id)
  }

  async list(): Promise<string[]> {
    return Array.from(this.documents.keys())
  }

  clear(): void {
    this.documents.clear()
  }
}

/**
 * Centralized state manager for WriterKit documents.
 * Coordinates document state with storage adapters and provides
 * state tracking and event emission.
 */
export class DocumentStateManager {
  private adapter: StorageAdapter | null = null
  private state: DocumentState = { status: 'idle' }
  private listeners: Map<keyof DocumentStateEvents, Set<Function>> = new Map()

  setAdapter(adapter: StorageAdapter): void {
    this.adapter = adapter
  }

  getAdapter(): StorageAdapter | null {
    return this.adapter
  }

  getState(): DocumentState {
    return this.state
  }

  private setState(state: DocumentState): void {
    this.state = state
    this.emit('stateChanged', state)
  }

  async save(document: StoredDocument): Promise<void> {
    if (!this.adapter) {
      throw new Error('No storage adapter configured')
    }

    this.setState({ status: 'saving' })

    try {
      await this.adapter.write(document)
      this.setState({ status: 'saved', document, at: new Date() })
      this.emit('saved', document)
    } catch (error) {
      this.setState({ status: 'error', error: error as Error })
      this.emit('error', error as Error)
      throw error
    }
  }

  async load(id: string): Promise<StoredDocument | null> {
    if (!this.adapter) {
      throw new Error('No storage adapter configured')
    }

    this.setState({ status: 'loading' })

    try {
      const document = await this.adapter.read(id)
      if (document) {
        this.setState({ status: 'loaded', document })
        this.emit('loaded', document)
      } else {
        this.setState({ status: 'idle' })
      }
      return document
    } catch (error) {
      this.setState({ status: 'error', error: error as Error })
      this.emit('error', error as Error)
      throw error
    }
  }

  markModified(): void {
    if (this.state.status === 'loaded' || this.state.status === 'saved') {
      const document = 'document' in this.state ? this.state.document : null
      if (document) {
        this.setState({ status: 'modified', document, since: new Date() })
      }
    }
  }

  on<K extends keyof DocumentStateEvents>(
    event: K,
    callback: DocumentStateEvents[K]
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  private emit<K extends keyof DocumentStateEvents>(
    event: K,
    ...args: Parameters<DocumentStateEvents[K]>
  ): void {
    this.listeners.get(event)?.forEach((callback) => {
      ;(callback as (...args: unknown[]) => void)(...args)
    })
  }
}
