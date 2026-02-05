# WriterKit Developer Feedback

## Test Date: 2026-02-05

## Summary

WriterKit is a ProseMirror-based word processor toolkit with React integration, markdown storage, and virtual pagination. Testing was conducted using a minimal Vite+React test application in `.testapp/`.

---

## What Works

### 1. Core Editor (Partial)
- ProseMirror editor initializes and renders
- Text input and editing works
- Document updates are tracked (console shows node count changes)
- Selection tracking works

### 2. Markdown Parsing
- YAML frontmatter is parsed correctly
- Metadata extraction works (title, pageSize, orientation)
- Initial content is parsed into document structure

### 3. React Context Architecture
- WriterKitProvider provides context to children
- Hooks are exported and callable (`useWriterKit`, `useDocumentState`, etc.)
- State management for dirty tracking works

### 4. Package Structure
- Single `writerkit` package with subpath exports works
- Tree-shakeable imports via `writerkit/core`, `writerkit/react`, etc.
- TypeScript types are properly exported

---

## What Doesn't Work

### 1. Pagination System (Critical)
**Status: Broken**

The ReflowEngine is created but never produces page boundaries:
- `pages` array is always empty
- `reflowCount` stays at 0
- `pageCount` stays at 0
- `forceFullReflow()` is called but has no effect

**Root cause investigation needed:**
- ReflowEngine state timing with React's render cycle
- Measurer may not have DOM elements to measure
- PageComputer may not be receiving measurements

### 2. Editor View Registration
**Status: Broken**

The UI shows "Editor: Disconnected" indicating the view isn't being registered properly with the context.

### 3. Browser Compatibility (gray-matter)
**Status: Requires Workaround**

The `gray-matter` library uses Node.js `Buffer` which isn't available in browsers. Consumer apps must add a polyfill:

```typescript
// Required in main.tsx before any imports
import { Buffer } from 'buffer'
globalThis.Buffer = Buffer
```

Plus Vite config:
```typescript
resolve: {
  alias: {
    buffer: resolve(__dirname, 'node_modules/buffer/'),
  },
},
```

### 4. Initial Content Loading
**Status: Fixed (but fragile)**

Initial content from `WriterKitProvider` wasn't being passed to the Editor component due to React lifecycle timing issues. Fixed by storing raw content in a ref and passing through internal context.

### 5. ProseMirror CSS
**Status: Warning**

Console warning: "ProseMirror expects the CSS white-space property to be set, preferably to 'pre-wrap'."

---

## Console Observations

```
Document changed: WriterKit Demo Document 34 nodes
Document updated: 35 nodes
Selection: 146 - 146
...
```

The editor IS receiving content and tracking changes, but:
- Pagination stats show 0 pages, 0 reflow count
- View shows as "Disconnected"

---

## Developer Experience Issues

### 1. No Default ProseMirror Styles
Consumer apps need to manually add ProseMirror CSS or configure white-space.

### 2. Complex Polyfill Requirements
The Buffer polyfill requirement is unexpected and not documented.

### 3. Tight Coupling Between Components
The Editor component is tightly coupled to WriterKitProvider context. It's difficult to use Editor standalone.

### 4. Debug Visibility
No console logging from ReflowEngine to diagnose why pagination fails.

---

## Rating: 4/10

| Category | Score | Notes |
|----------|-------|-------|
| Core Editor | 6/10 | Works but has CSS warnings |
| Pagination | 1/10 | Completely non-functional |
| React Integration | 5/10 | Context works, but timing issues |
| Browser Compatibility | 3/10 | Requires manual polyfills |
| Documentation | 2/10 | Missing setup requirements |
| DX (Developer Experience) | 4/10 | Hard to debug, tight coupling |
| TypeScript | 8/10 | Good type exports |
| Package Structure | 8/10 | Subpath exports work well |

---

## Priority Improvements

### Critical (Must Fix)

1. **Fix Pagination System**
   - Add debug logging to ReflowEngine
   - Verify Measurer is receiving DOM elements
   - Ensure PageComputer.compute() is called with valid document
   - Add integration tests for pagination flow

2. **Fix View Registration**
   - Debug why `_registerView` isn't connecting properly
   - Ensure view state updates trigger re-renders

3. **Replace gray-matter**
   - Use a browser-native YAML frontmatter parser
   - Or bundle the polyfill within the library

### High Priority

4. **Add ProseMirror CSS**
   - Include default styles in the package
   - Or document CSS requirements clearly

5. **Improve Debug Experience**
   - Add `debug` mode that logs ReflowEngine activity
   - Expose internal state for debugging

6. **Decouple Editor from Provider**
   - Allow Editor to work standalone with props
   - Make context optional enhancement

### Medium Priority

7. **Add Integration Tests**
   - Test full flow: Provider → Editor → Pagination
   - Test in browser environment (Playwright)

8. **Documentation**
   - Add setup guide with all requirements
   - Document polyfill requirements
   - Add troubleshooting section

---

## Suggested Next Steps

1. Add console.log statements to trace the pagination flow:
   ```typescript
   // In ReflowEngine.performReflow()
   console.log('ReflowEngine: performReflow called, view:', !!this.view)
   console.log('ReflowEngine: doc:', doc?.content?.size)
   console.log('ReflowEngine: measurements:', measurements.length)
   console.log('ReflowEngine: pages:', newModel.pages.length)
   ```

2. Check if the Editor's `useEffect` runs BEFORE or AFTER the ReflowEngine is created (React StrictMode double-renders may cause issues)

3. Verify the ReflowEngine receives the EditorView:
   ```typescript
   // In registerView callback
   console.log('registerView called:', !!editorView, !!reflowEngine)
   ```

4. Test pagination in isolation (unit test) to verify PageComputer works

---

## Test App Location

The test app is in `.testapp/` (gitignored). Run with:
```bash
cd .testapp && npx vite
```

---

## Files Modified During Testing

- `packages/writerkit/src/react/index.tsx` - Multiple fixes for timing issues
- `.testapp/*` - Test application files
- `.gitignore` - Added .testapp/
