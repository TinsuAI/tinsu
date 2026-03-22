import { app, shell, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { db } from './db'
import { settings } from './db/schema'
import { eq } from 'drizzle-orm'
import { createIPCHandler } from 'trpc-electron/main'
import { appRouter, createContext } from './trpc'
import { ptyService, TmuxService, TaskTerminalService, StallDetectorService, hookListenerService } from './services'

// Disable sandbox for Linux development only (SUID sandbox not configured in dev environments)
// Production builds should run with proper sandbox configuration via electron-builder
if (process.platform === 'linux' && !app.isPackaged) {
  app.commandLine.appendSwitch('no-sandbox')
}

// Fix multi-monitor input issues when running over X11 forwarding (SSH -X/-Y).
// Chromium's XInput2 miscomputes coordinates across the virtual screen geometry.
if (process.env.SSH_CONNECTION || process.env.SSH_CLIENT) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
  app.commandLine.appendSwitch('disable-software-rasterizer')
  app.commandLine.appendSwitch('in-process-gpu')
  app.commandLine.appendSwitch('disable-features', 'UseOzonePlatform')
  app.commandLine.appendSwitch('disable-dev-shm-usage')
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // sandbox: false required for preload scripts to access Node.js APIs (needed for tRPC/node-pty in later stories)
      sandbox: false,
      // contextIsolation must be true for contextBridge.exposeInMainWorld to work
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Check if tmux is installed (required for per-task terminal sessions)
async function checkTmuxDependency(): Promise<boolean> {
  console.log('[TMUX] Checking tmux installation...')

  try {
    const isInstalled = await TmuxService.checkTmuxInstalled()

    if (!isInstalled) {
      console.log('[TMUX] tmux not found - showing error dialog')
      const message = TmuxService.getInstallInstructions()
      dialog.showErrorBox('tmux Required', message)
      return false
    }

    const version = await TmuxService.getTmuxVersion()
    console.log(`[TMUX] tmux installed, version: ${version}`)
    return true
  } catch (error) {
    console.error('[TMUX] Error checking tmux:', error)
    dialog.showErrorBox(
      'tmux Check Failed',
      `TinSu could not verify tmux installation.\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nPlease ensure tmux is installed and try again.`
    )
    return false
  }
}

// Initialize database and verify connectivity
function initializeDatabase(): boolean {
  console.log('[DB] Initializing database...')

  try {
    // Verify database is accessible with a simple insert/select test
    const testKey = 'app_initialized'
    const testId = 'init-test-1'

    // Check if test setting exists
    const existing = db.select().from(settings).where(eq(settings.key, testKey)).get()

    if (!existing) {
      // Insert test setting
      db.insert(settings)
        .values({ id: testId, key: testKey, value: new Date().toISOString() })
        .run()
      console.log('[DB] Initial test setting created')
    } else {
      // Update the value to verify write capability
      db.update(settings)
        .set({ value: new Date().toISOString() })
        .where(eq(settings.key, testKey))
        .run()
      console.log('[DB] Test setting updated')
    }

    console.log('[DB] Database initialized successfully')
    return true
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error)
    return false
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Check tmux dependency before proceeding
  const tmuxAvailable = await checkTmuxDependency()
  if (!tmuxAvailable) {
    app.quit()
    return
  }

  // Initialize database on app ready
  initializeDatabase()

  // TES-1.10: Validate stale sessions on startup
  // Must run AFTER database is initialized, BEFORE tRPC handlers process requests
  try {
    await TaskTerminalService.validateSessionsOnStartup()
  } catch (error) {
    console.warn('[main] Session validation failed:', error)
    // Don't block startup - continue with potentially stale records
  }

  // TES-2.3: Start hook listener HTTP server for Claude Code hook events
  // Port can be overridden via TINSU_HOOK_PORT environment variable
  try {
    const hookPort = process.env.TINSU_HOOK_PORT ? parseInt(process.env.TINSU_HOOK_PORT, 10) : 3847
    await hookListenerService.start(hookPort)
  } catch (error) {
    console.warn('[main] Hook listener failed to start:', error)
    // Don't block startup - graceful degradation if hook server unavailable
  }

  // Initialize tRPC IPC handler before window creation
  createIPCHandler({ router: appRouter, createContext })

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up PTY processes before the app quits
// This prevents zombie processes from lingering after the app closes
app.on('before-quit', async () => {
  // TES-1.11: Stop all session monitors and stall detection
  console.log('[TES-1.11] Stopping session monitors and stall detection...')
  TaskTerminalService.stopAllSessionMonitors()
  StallDetectorService.clearAll()

  // TES-2.3: Stop hook listener HTTP server
  if (hookListenerService.isRunning()) {
    console.log('[TES-2.3] Stopping hook listener HTTP server...')
    await hookListenerService.stop()
  }

  const processCount = ptyService.getProcessCount()
  if (processCount > 0) {
    console.log(`[PTY] Cleaning up ${processCount} active PTY process(es)...`)
    ptyService.killAll()
    console.log('[PTY] All PTY processes terminated')
  }
})

// Log unexpected PTY process errors for debugging
ptyService.on('error', ({ processId, error }) => {
  console.error(`[PTY] Process ${processId} error:`, error)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
