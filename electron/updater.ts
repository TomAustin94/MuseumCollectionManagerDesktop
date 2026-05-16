import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'

export function triggerUpdateCheck(): void {
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Update check failed:', err)
  })
}

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.autoDownload = false

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', { status: 'available', version: (info as { version: string }).version })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status', { status: 'not-available' })
  })

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-status', { status: 'error', error: err.message })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('update-status', { status: 'downloading', percent: Math.round((progressObj as { percent: number }).percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-status', { status: 'downloaded', version: (info as { version: string }).version })
  })

  ipcMain.handle('check-for-updates', async () => {
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      console.error('Update check failed:', err)
    }
  })

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  // Check on launch after a short delay (gives the window time to render)
  setTimeout(() => triggerUpdateCheck(), 10_000)
}
