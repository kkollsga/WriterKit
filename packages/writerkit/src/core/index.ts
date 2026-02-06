// Core exports
export { Editor } from './Editor'
export { Extension } from './Extension'
export { Node } from './Node'
export { Mark } from './Mark'
export { ExtensionManager } from './ExtensionManager'
export { CommandManager, builtInCommands } from './CommandManager'

// Types
export type {
  // Document
  DocumentMetadata,

  // Editor
  EditorConfig,
  WriterKitEditor,
  JSONContent,
  EditorEvents,
  ChainedCommands,
  CanCommands,

  // Extensions
  WriterKitExtension,
  ExtensionCreateOptions,
  CommandFunction,
  CommandProps,
  InputRule,
  PasteRule,
} from './types'

// Re-export useful ProseMirror types for convenience
export type {
  Node as ProseMirrorNode,
  Mark as ProseMirrorMark,
  Schema,
  NodeSpec,
  MarkSpec,
} from 'prosemirror-model'

export type {
  EditorState,
  Transaction,
  Plugin,
  PluginKey,
} from 'prosemirror-state'

export type { EditorView } from 'prosemirror-view'
