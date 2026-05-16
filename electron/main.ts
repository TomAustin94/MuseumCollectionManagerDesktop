import { app, BrowserWindow, Menu, ipcMain, shell, dialog } from 'electron'
import { Server } from 'http'
import path from 'path'
import fs from 'fs'
import { initLogger, write, getLogFilePath } from './logger'
import { runMigrations } from './db/migrate'
import { closeDb, getDb } from './db/client'
import { cleanupExpiredSessions } from './auth/session'
import { registerAuthHandlers } from './ipc/auth'
import { registerItemsHandlers } from './ipc/items'
import { registerCategoriesHandlers } from './ipc/categories'
import { registerLocationsHandlers } from './ipc/locations'
import { registerReportsHandlers } from './ipc/reports'
import { registerExportHandlers } from './ipc/export'
import { registerAdminHandlers } from './ipc/admin'
import { registerSettingsHandlers } from './ipc/settings'
import { getSetting, loadSettings } from './settings'
import { setupAutoUpdater, triggerUpdateCheck } from './updater'
import { createApiServer } from './server'
import { registerClientProxyHandlers } from './client-proxy'

let mainWindow: BrowserWindow | null = null
let apiServer: Server | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    // Hide the native menu bar on Win/Linux; keep macOS system menu bar
    autoHideMenuBar: process.platform !== 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../preload/index.js')
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Open devtools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.getName(),
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Item',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('navigate', '/items/new')
          }
        },
        { type: 'separator' },
        {
          label: 'Export to CSV...',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow?.webContents.send('export-csv')
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
              { type: 'separator' as const },
              {
                label: 'Speech',
                submenu: [
                  { role: 'startSpeaking' as const },
                  { role: 'stopSpeaking' as const }
                ]
              }
            ]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }])
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow?.webContents.send('navigate', '/')
        },
        {
          label: 'Items',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow?.webContents.send('navigate', '/items')
        },
        {
          label: 'Categories',
          accelerator: 'CmdOrCtrl+3',
          click: () => mainWindow?.webContents.send('navigate', '/categories')
        },
        {
          label: 'Locations',
          accelerator: 'CmdOrCtrl+4',
          click: () => mainWindow?.webContents.send('navigate', '/locations')
        },
        {
          label: 'Reports',
          accelerator: 'CmdOrCtrl+5',
          click: () => mainWindow?.webContents.send('navigate', '/reports')
        },
        { type: 'separator' },
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Museum Collection Manager',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Museum Collection Manager',
              message: 'Museum Collection Manager',
              detail: `Version ${app.getVersion()}\n\nA desktop application for managing museum collections.`
            })
          }
        },
        {
          label: 'Check for Updates',
          click: () => triggerUpdateCheck()
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function scheduleDailyBackup(): void {
  // Run backup check every hour
  const HOUR = 60 * 60 * 1000
  setInterval(() => {
    const lastBackupFile = path.join(app.getPath('userData'), '.last-backup')
    let shouldBackup = true

    if (fs.existsSync(lastBackupFile)) {
      const lastBackup = new Date(fs.readFileSync(lastBackupFile, 'utf-8'))
      const now = new Date()
      const hoursSinceBackup = (now.getTime() - lastBackup.getTime()) / HOUR
      if (hoursSinceBackup < 24) {
        shouldBackup = false
      }
    }

    if (shouldBackup) {
      performBackup()
    }
  }, HOUR)
}

function performBackup(): void {
  try {
    const userData = app.getPath('userData')
    const customDir = getSetting('backupDir')
    const backupDir = customDir ?? path.join(userData, 'backups')

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    // Keep only last 7 automatic backups in the target directory
    const backups = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('collection-') && f.endsWith('.db'))
      .sort()
      .reverse()
    if (backups.length >= 7) {
      backups.slice(6).forEach((b) => fs.unlinkSync(path.join(backupDir, b)))
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `collection-${timestamp}.db`)

    const db = getDb()
    db.backup(backupPath)

    const lastBackupFile = path.join(userData, '.last-backup')
    fs.writeFileSync(lastBackupFile, new Date().toISOString())

    console.log(`Database backed up to ${backupPath}`)
  } catch (err) {
    console.error('Backup failed:', err)
  }
}

// Expose backup function for IPC
ipcMain.handle('db:backup', async () => {
  performBackup()
  return { success: true }
})

// Renderer → main log relay
ipcMain.on('log:renderer', (_event, level: string, msg: string) => {
  write(level, [msg])
})

// Expose log file path so the renderer can tell the user where to find it
ipcMain.handle('log:get-path', () => getLogFilePath())

app.whenReady().then(() => {
  initLogger()
  console.log('app ready')

  const { networkMode, serverPort } = loadSettings()
  console.log(`Network mode: ${networkMode}`)

  if (networkMode === 'client') {
    // Client mode: no local DB, proxy all IPC to server over HTTP
    registerSettingsHandlers()
    registerClientProxyHandlers()
    console.log('Client proxy handlers registered')
  } else {
    // Standalone or Server mode: run local DB
    try {
      runMigrations()
      console.log('migrations OK')
    } catch (err) {
      console.error('migrations FAILED', err)
      dialog.showErrorBox(
        'Startup error',
        `Database initialisation failed:\n\n${err instanceof Error ? err.stack : String(err)}`
      )
      app.quit()
      return
    }

    cleanupExpiredSessions()

    registerAuthHandlers()
    registerItemsHandlers()
    registerCategoriesHandlers()
    registerLocationsHandlers()
    registerReportsHandlers()
    registerExportHandlers()
    registerAdminHandlers()
    registerSettingsHandlers()
    console.log('IPC handlers registered')

    if (networkMode === 'server') {
      // Also start the HTTP API server for remote clients
      apiServer = createApiServer(serverPort)
    }

    scheduleDailyBackup()
  }

  createWindow()
  buildMenu()

  if (networkMode !== 'client') {
    setupAutoUpdater(mainWindow!)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (apiServer) {
    apiServer.close()
    apiServer = null
  }
  if (getSetting('networkMode') !== 'client') {
    closeDb()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (apiServer) {
    apiServer.close()
    apiServer = null
  }
  if (getSetting('networkMode') !== 'client') {
    closeDb()
  }
})
