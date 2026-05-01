/**
 * vitest.touch-targets.config.ts
 *
 * Minimal vitest config for the touch-target audit script.
 * Overrides the main vitest.config.ts include pattern so that
 * `scripts/audit-touch-targets.ts` is discovered and run.
 *
 * Usage: npm run audit:touch-targets
 * Story: T3.5-9, AC 12
 */
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, '../src'),
      '@shared': path.resolve(__dirname, '../src/shared'),
      'monaco-editor': path.resolve(__dirname, '../src/__mocks__/monaco-editor.ts'),
      '@tauri-apps/plugin-os': path.resolve(__dirname, '../src/__mocks__/tauri-plugin-os.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',  // Audit script uses fs, not DOM — node env is correct
    include: ['scripts/audit-touch-targets.ts'],
    setupFiles: [],        // No DOM setup needed for fs-based audit
  },
})
