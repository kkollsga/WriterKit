/**
 * @writerkit/test-fixtures
 *
 * Test fixtures for WriterKit - sample documents and baseline comparison files.
 */

// Simple test document for basic parsing tests
export const simpleDocument = `---
title: Simple Test Document
createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-01T00:00:00Z"
pageSize: a4
orientation: portrait
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---

# Simple Document

This is a simple test document with basic formatting.

**Bold text** and *italic text* are supported.

## Second Heading

A paragraph with a [link](https://example.com).

\`\`\`javascript
const x = 1
\`\`\`
`

// Document with page breaks
export const pageBreakDocument = `---
title: Page Break Document
createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-01T00:00:00Z"
pageSize: a4
orientation: portrait
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---

# Page 1

Content on the first page.

<!-- page-break -->

# Page 2

Content on the second page.

<!-- page-break -->

# Page 3

Content on the third page.
`

// Document with all formatting options
export const allFormattingDocument = `---
title: All Formatting Document
author: Test Author
createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-01T00:00:00Z"
pageSize: letter
orientation: landscape
margins:
  top: 54
  right: 54
  bottom: 54
  left: 54
header:
  center: "{{title}}"
footer:
  center: "Page {{pageNumber}} of {{totalPages}}"
---

# Heading 1

## Heading 2

### Heading 3

#### Heading 4

##### Heading 5

###### Heading 6

Regular paragraph text.

**Bold text** and *italic text* and ***bold italic***.

\`inline code\` in a sentence.

\`\`\`typescript
interface User {
  name: string
  email: string
}

const user: User = {
  name: "John",
  email: "john@example.com"
}
\`\`\`

> This is a blockquote.
> It can span multiple lines.

- Bullet item 1
- Bullet item 2
  - Nested item 2a
  - Nested item 2b
- Bullet item 3

1. Ordered item 1
2. Ordered item 2
3. Ordered item 3

---

[Link to example](https://example.com "Example Site")

![Alt text](image.png "Image title")
`

// Document with a table
export const tableDocument = `---
title: Table Document
createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-01T00:00:00Z"
pageSize: a4
orientation: portrait
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---

# Document with Table

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
| Cell 7   | Cell 8   | Cell 9   |

Some text after the table.
`

// Empty document (just frontmatter)
export const emptyDocument = `---
title: Empty Document
createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-01T00:00:00Z"
pageSize: a4
orientation: portrait
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---
`

// Document without frontmatter
export const noFrontmatterDocument = `# No Frontmatter

This document has no YAML frontmatter.

It should still parse correctly with default metadata.
`

// Multi-page document for pagination testing
export const multiPageDocument = `---
title: Multi-Page Document
createdAt: "2025-01-01T00:00:00Z"
modifiedAt: "2025-01-01T00:00:00Z"
pageSize: a4
orientation: portrait
margins:
  top: 72
  right: 72
  bottom: 72
  left: 72
---

# Chapter 1: Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

## Section 1.1

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

## Section 1.2

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

<!-- page-break -->

# Chapter 2: Main Content

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.

## Section 2.1

Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur?

## Section 2.2

Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?

<!-- page-break -->

# Chapter 3: Conclusion

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.

Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.
`

// Export all fixtures as a collection
export const fixtures = {
  simple: simpleDocument,
  pageBreak: pageBreakDocument,
  allFormatting: allFormattingDocument,
  table: tableDocument,
  empty: emptyDocument,
  noFrontmatter: noFrontmatterDocument,
  multiPage: multiPageDocument,
}
