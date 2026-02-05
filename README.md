# WriterKit

A ProseMirror-based toolkit for building word processors with native pagination support, markdown storage, and searchable PDF export.

## Features

- **Native Pagination**: Pages computed from content flow, not CSS hacks
- **Markdown Native**: Markdown as the single source of truth with YAML frontmatter
- **Searchable Exports**: PDF with real text (not screenshots), DOCX, and ODT
- **High Performance**: Incremental reflow, virtual pagination, measurement caching
- **Extensible**: TipTap-inspired extension system

## Packages

| Package | Description |
|---------|-------------|
| `@writerkit/core` | Core editor, extensions, and document model |
| `@writerkit/pagination` | Page computation engine |
| `@writerkit/markdown` | Markdown parsing and serialization |
| `@writerkit/export` | PDF, DOCX, and ODT export |
| `@writerkit/storage` | Storage abstraction layer |
| `@writerkit/react` | React bindings |
| `@writerkit/extensions` | Built-in extensions (tables, images, headers/footers) |

## Quick Start

```typescript
import { Extension, Node, Mark } from '@writerkit/core'

// Create a custom extension
const MyExtension = Extension.create({
  name: 'myExtension',

  addOptions() {
    return {
      enabled: true,
    }
  },

  addCommands() {
    return {
      myCommand: () => ({ state, dispatch }) => {
        // Command implementation
        return true
      }
    }
  }
})

// Create a node
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'p' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', HTMLAttributes, 0]
  }
})

// Create a mark
const Bold = Mark.create({
  name: 'bold',

  parseHTML() {
    return [
      { tag: 'strong' },
      { tag: 'b' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['strong', HTMLAttributes, 0]
  }
})
```

## Document Format

WriterKit uses markdown with YAML frontmatter:

```markdown
---
title: My Document
pageSize: a4
orientation: portrait
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---

# Introduction

This is the first paragraph.

<!-- page-break -->

# Chapter 2

Content continues on the next page.
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

## License

MIT
