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
let isQuitting = false
let cleanupDone = false

async function showBackupPromptAndQuit(win: BrowserWindow | null): Promise<boolean> {
  const lastBackupFile = path.join(app.getPath('userData'), '.last-backup')
  let lastBackupText = 'Never'
  if (fs.existsSync(lastBackupFile)) {
    try {
      lastBackupText = new Date(fs.readFileSync(lastBackupFile, 'utf-8')).toLocaleString()
    } catch { /* ignore */ }
  }

  const opts: Electron.MessageBoxOptions = {
    type: 'question',
    title: 'Back up before closing?',
    message: 'Would you like to back up the database before closing?',
    detail: `Last backup: ${lastBackupText}`,
    buttons: ['Back Up & Close', 'Close Without Backup', 'Cancel'],
    defaultId: 0,
    cancelId: 2
  }

  const { response } = win
    ? await dialog.showMessageBox(win, opts)
    : await dialog.showMessageBox(opts)

  if (response === 2) return false
  if (response === 0) await performBackup(true)
  return true
}

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

  mainWindow.on('close', async (event) => {
    if (isQuitting || getSetting('networkMode') === 'client') return
    event.preventDefault()
    const shouldQuit = await showBackupPromptAndQuit(mainWindow!)
    if (shouldQuit) {
      isQuitting = true
      app.quit()
    }
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
  const HOUR = 60 * 60 * 1000
  setInterval(() => {
    const scheduleHour = getSetting('backupScheduleHour')
    const now = new Date()

    if (now.getHours() !== scheduleHour) return

    const lastBackupFile = path.join(app.getPath('userData'), '.last-backup')
    if (fs.existsSync(lastBackupFile)) {
      try {
        const lastBackup = new Date(fs.readFileSync(lastBackupFile, 'utf-8'))
        const hoursSince = (now.getTime() - lastBackup.getTime()) / HOUR
        if (hoursSince < 23) return
      } catch {
        // corrupt file — proceed with backup
      }
    }

    performBackup(false)
  }, HOUR)
}

async function performBackup(showErrorDialog: boolean): Promise<boolean> {
  try {
    const userData = app.getPath('userData')
    const customDir = getSetting('backupDir')
    const backupDir = customDir ?? path.join(userData, 'backups')

    if (customDir && !fs.existsSync(customDir)) {
      throw new Error(
        `INACCESSIBLE:The backup folder "${customDir}" cannot be found.\n\nPlease check:\n• Network connectivity (if using a NAS or network drive)\n• That the folder still exists\n• That you have write permission\n\nYou can change the backup location in Settings.`
      )
    }

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const retention = getSetting('backupRetention')
    const backups = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('collection-') && f.endsWith('.db'))
      .sort()
      .reverse()
    if (backups.length >= retention) {
      backups.slice(retention - 1).forEach((b) => fs.unlinkSync(path.join(backupDir, b)))
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `collection-${timestamp}.db`)

    const db = getDb()
    await db.backup(backupPath)

    const lastBackupFile = path.join(userData, '.last-backup')
    fs.writeFileSync(lastBackupFile, new Date().toISOString())

    console.log(`Database backed up to ${backupPath}`)
    return true
  } catch (err) {
    console.error('Backup failed:', err)

    if (showErrorDialog && mainWindow) {
      const msg = err instanceof Error ? err.message : String(err)
      const isInaccessible = msg.startsWith('INACCESSIBLE:')
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Backup Failed',
        message: isInaccessible ? 'Backup location is inaccessible' : 'Backup failed',
        detail: isInaccessible
          ? msg.replace('INACCESSIBLE:', '')
          : `An error occurred during backup:\n${msg}\n\nYou can change the backup location in Settings.`,
        buttons: ['OK']
      })
    }

    return false
  }
}

// Expose backup function for IPC
ipcMain.handle('db:backup', async () => {
  const ok = await performBackup(true)
  return { success: ok }
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

function doCleanup(): void {
  if (cleanupDone) return
  cleanupDone = true
  if (apiServer) { apiServer.close(); apiServer = null }
  if (getSetting('networkMode') !== 'client') { closeDb() }
}

app.on('window-all-closed', () => {
  if (!isQuitting && process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (event) => {
  if (isQuitting) {
    doCleanup()
    return
  }
  if (getSetting('networkMode') === 'client') {
    doCleanup()
    return
  }
  // Handles macOS Cmd+Q (fires before window 'close')
  if (process.platform !== 'darwin') {
    doCleanup()
    return
  }
  event.preventDefault()
  const win = BrowserWindow.getAllWindows()[0] ?? null
  const shouldQuit = await showBackupPromptAndQuit(win)
  if (shouldQuit) {
    isQuitting = true
    app.quit()
  }
})
