import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      // Redirect monaco-editor to a stub to avoid Vite bundler resolution errors.
      // monaco-editor has non-standard ESM exports; tests that use Monaco components
      // already mock @monaco-editor/react, so this stub is never actually called.
      'monaco-editor': path.resolve(__dirname, 'src/__mocks__/monaco-editor.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'src-tauri'],
    setupFiles: ['src/test-setup.ts'],
  },
})
