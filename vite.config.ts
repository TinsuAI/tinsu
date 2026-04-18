import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  // Required for Tauri: use relative paths in build output
  base: '/',
  build: {
    // Tauri uses ES modules
    target: ['es2021', 'chrome100', 'safari13'],
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Source maps
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: 'dist',
  },
  // Tauri dev server
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  // Required: clear screen for Tauri CLI to detect ready state
  clearScreen: false,
})
