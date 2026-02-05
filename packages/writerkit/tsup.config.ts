import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'markdown/index': 'src/markdown/index.ts',
    'pagination/index': 'src/pagination/index.ts',
    'export/index': 'src/export/index.ts',
    'storage/index': 'src/storage/index.ts',
    'extensions/index': 'src/extensions/index.ts',
    'react/index': 'src/react/index.tsx',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    'react',
    'react-dom',
  ],
})
