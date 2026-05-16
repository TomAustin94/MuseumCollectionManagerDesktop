import { ipcMain, dialog } from 'electron'
import { loadSettings, setSetting } from '../settings'
import { requireAuth } from '../auth/session'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (event) => {
    await requireAuth(event)
    return loadSettings()
  })

  ipcMain.handle('settings:set-backup-dir', async (event, dir: unknown) => {
    await requireAuth(event)
    const value = dir === null ? null : String(dir)
    setSetting('backupDir', value)
    return { success: true }
  })

  ipcMain.handle('settings:choose-backup-dir', async (event) => {
    await requireAuth(event)
    const result = await dialog.showOpenDialog({
      title: 'Choose Backup Location',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true, path: null }
    }
    const chosen = result.filePaths[0]
    setSetting('backupDir', chosen)
    return { cancelled: false, path: chosen }
  })
}
