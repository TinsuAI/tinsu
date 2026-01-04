import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { db } from './db'
import { settings } from './db/schema'
import { eq } from 'drizzle-orm'

// Disable sandbox for Linux development only (SUID sandbox not configured in dev environments)
// Production builds should run with proper sandbox configuration via electron-builder
if (process.platform === 'linux' && !app.isPackaged) {
  app.commandLine.appendSwitch('no-sandbox')
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
      sandbox: false
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
app.whenReady().then(() => {
  // Initialize database on app ready
  initializeDatabase()

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
