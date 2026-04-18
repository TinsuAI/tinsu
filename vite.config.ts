import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devHost = process.env.TAURI_DEV_HOST ?? env.TAURI_DEV_HOST

  return {
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
      host: devHost ?? '0.0.0.0',
      // Tell the Android WebView's HMR client where to connect.
      // Without an explicit host the WebSocket falls back to the wrong interface.
      hmr: devHost
        ? { protocol: 'ws', host: devHost, port: 5173 }
        : undefined,
      watch: {
        ignored: ['**/src-tauri/**'],
      },
    },
    // Required: clear screen for Tauri CLI to detect ready state
    clearScreen: false,
  }
})
