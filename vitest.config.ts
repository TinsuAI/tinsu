import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer/src'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  test: {
    globals: true,
    projects: [
      {
        // Main process tests (Node.js environment)
        test: {
          name: 'main',
          environment: 'node',
          include: ['src/main/**/*.test.ts'],
          exclude: ['node_modules', 'out', 'dist']
        }
      },
      {
        // Renderer process tests (Browser environment)
        resolve: {
          alias: {
            '@renderer': path.resolve(__dirname, 'src/renderer/src'),
            '@shared': path.resolve(__dirname, 'src/shared')
          }
        },
        test: {
          name: 'renderer',
          environment: 'happy-dom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          exclude: ['node_modules', 'out', 'dist'],
          setupFiles: ['src/renderer/src/test-setup.ts']
        }
      }
    ]
  }
})
