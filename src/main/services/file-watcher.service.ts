import chokidar, { type FSWatcher } from 'chokidar'

/**
 * Debounce utility function.
 */
function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      func(...args)
      timeoutId = null
    }, wait)
  }
}

/**
 * Service for watching story files in the implementation-artifacts directory.
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 *
 * Uses chokidar for cross-platform file watching with built-in debouncing
 * to handle rapid file changes gracefully.
 *
 * @example
 * ```typescript
 * const watcher = new FileWatcherService()
 *
 * watcher.startWatching('/path/to/implementation-artifacts', (filePath) => {
 *   console.log('File changed:', filePath)
 * })
 *
 * // Later, when project is closed
 * await watcher.stopWatching()
 * ```
 */
export class FileWatcherService {
  private watcher: FSWatcher | null = null
  private debouncedCallbacks: Map<string, ReturnType<typeof debounce>> = new Map()

  /**
   * Start watching story files in a directory.
   * Only .md files will trigger change events.
   *
   * @param watchPath - Directory path to watch (typically implementation-artifacts)
   * @param onChange - Callback invoked when a .md file changes (debounced 300ms)
   *
   * @example
   * ```typescript
   * const watcher = new FileWatcherService()
   * watcher.startWatching('/project/_bmad-output/implementation-artifacts', (filePath) => {
   *   console.log('Story file changed:', filePath)
   * })
   * ```
   */
  startWatching(watchPath: string, onChange: (filePath: string) => void): void {
    // Stop any existing watcher
    if (this.watcher) {
      this.stopWatching()
    }

    // Create debounced callback for each file
    const getOrCreateDebouncedCallback = (filePath: string) => {
      if (!this.debouncedCallbacks.has(filePath)) {
        this.debouncedCallbacks.set(filePath, debounce(onChange as (...args: unknown[]) => void, 300))
      }
      return this.debouncedCallbacks.get(filePath)!
    }

    this.watcher = chokidar.watch(watchPath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      },
      // Watch only .md files in the directory (not subdirectories)
      depth: 0
    })

    this.watcher.on('change', (filePath: string) => {
      // Only process markdown files
      if (filePath.endsWith('.md')) {
        const debouncedCallback = getOrCreateDebouncedCallback(filePath)
        debouncedCallback(filePath)
      }
    })

    this.watcher.on('error', (error) => {
      console.error('FileWatcherService error:', error)
    })
  }

  /**
   * Stop watching files and clean up resources.
   * Safe to call multiple times.
   *
   * @returns Promise that resolves when the watcher is fully closed
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.debouncedCallbacks.clear()
  }

  /**
   * Check if currently watching files.
   *
   * @returns true if watching, false otherwise
   */
  isWatching(): boolean {
    return this.watcher !== null
  }
}
